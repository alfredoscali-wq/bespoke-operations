import { NextResponse } from "next/server"

import { readLatamClientsByIdentifiers } from "@/lib/integrations/latam-tv/client"
import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import type { LatamBatchClient } from "@/lib/integrations/latam-tv/lookup-state"
import { excludeAbnetPadronRows } from "@/lib/subscriptions/abnet-tv-padron-exclusions"
import {
  loadAbnetTvPadronSourceRows,
  loadActiveAbnetTvPadronExclusions,
} from "@/lib/subscriptions/abnet-tv-padron-source"
import {
  abnetPadronCustomerNumber,
  presentAbnetPadronRow,
  summarizeAbnetTvPadron,
  withAbnetPadronDuplicates,
  type AbnetTvPadronRow,
} from "@/lib/subscriptions/abnet-tv-padron"
import { PACK_FUTBOL_CODE } from "@/lib/subscriptions/pack-futbol"
import { requireSubscriptionsReadContext } from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const PAGE = 1000
const LATAM_BATCH_LIMIT = 50

function latamBatchIds(raw: string): string[] {
  return [
    ...new Set(
      raw.split(",").flatMap((value) => {
        const number = abnetPadronCustomerNumber(value)
        return number ? [number] : []
      })
    ),
  ].slice(0, LATAM_BATCH_LIMIT)
}

function unavailableLatamBatch(ids: readonly string[]): Record<string, LatamBatchClient> {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { phase: "unavailable", identifier: null, iptvId: null, username: null, planName: null },
    ])
  )
}

async function readLatamBatch(raw: string) {
  const ids = latamBatchIds(raw)
  if (ids.length === 0) return NextResponse.json({ success: true, clients: {} })
  const config = readLatamTvConfig()
  if (!config) return NextResponse.json({ success: true, clients: unavailableLatamBatch(ids) })
  try {
    const clients = await readLatamClientsByIdentifiers(ids, { ...config, timeoutMs: 20_000 })
    return NextResponse.json({ success: true, clients })
  } catch {
    return NextResponse.json({ success: true, clients: unavailableLatamBatch(ids) })
  }
}

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
  in: (column: string, values: readonly string[]) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  order: (column: string) => LooseFilter
  range: (
    from: number,
    to: number
  ) => Promise<{
    data: Record<string, unknown>[] | null
    error: { code?: string; message: string } | null
  }>
}

function looseDb(client: unknown) {
  return client as {
    from: (table: string) => { select: (columns: string) => LooseFilter }
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function readPages(
  read: (from: number, to: number) => Promise<{
    data: Record<string, unknown>[] | null
    error: { code?: string; message: string } | null
  }>
) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) return { rows: null as Record<string, unknown>[] | null, error }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return { rows, error: null }
}

async function readCustomerMatches(client: Awaited<ReturnType<typeof createClient>>, companyId: string) {
  const matches = new Map<
    string,
    { id: string; customerNumber: string; name: string } | "ambiguous"
  >()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("customers")
      .select("id, name, customer_number, external_customer_code")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("external_customer_code", "is", null)
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) return { matches, error }
    const batch = data ?? []
    for (const row of batch) {
      const number = abnetPadronCustomerNumber(row.external_customer_code)
      if (!number) continue
      const current = matches.get(number)
      const next = {
        id: row.id,
        customerNumber: row.customer_number?.trim() ?? "",
        name: row.name?.trim() ?? "",
      }
      if (!current) matches.set(number, next)
      else if (current !== "ambiguous" && current.id !== next.id) {
        matches.set(number, "ambiguous")
      }
    }
    if (batch.length < PAGE) break
  }
  return { matches, error: null }
}

async function readPackCustomerIds(client: unknown, companyId: string) {
  const components = await looseDb(client)
    .from("isp_commercial_components")
    .select("id, code")
    .eq("company_id", companyId)
    .eq("code", PACK_FUTBOL_CODE)
    .is("deleted_at", null)
    .order("id")
    .range(0, 20)
  if (components.error || !components.data?.length) return new Set<string>()
  const componentIds = components.data.map((row) => text(row.id)).filter(Boolean)
  const assignments = await readPages((from, to) =>
    looseDb(client)
      .from("isp_service_components")
      .select("service_id")
      .eq("company_id", companyId)
      .eq("status", "active")
      .in("component_id", componentIds)
      .is("deleted_at", null)
      .order("id")
      .range(from, to)
  )
  if (assignments.error) return new Set<string>()
  const serviceIds = [
    ...new Set((assignments.rows ?? []).map((row) => text(row.service_id)).filter(Boolean)),
  ]
  const customerIds = new Set<string>()
  const db = client as Awaited<ReturnType<typeof createClient>>
  for (let index = 0; index < serviceIds.length; index += 100) {
    const { data, error } = await db
      .from("isp_services")
      .select("customer_id")
      .eq("company_id", companyId)
      .in("id", serviceIds.slice(index, index + 100))
      .is("deleted_at", null)
    if (error) continue
    for (const row of data ?? []) {
      if (row.customer_id) customerIds.add(row.customer_id)
    }
  }
  return customerIds
}

function attachBespoke(
  rows: AbnetTvPadronRow[],
  matches: Map<string, { id: string; customerNumber: string; name: string } | "ambiguous">,
  packCustomerIds: Set<string>
) {
  return rows.map((row) => {
    const match = matches.get(row.abnetCustomerNumber)
    if (!match || match === "ambiguous") return row
    return {
      ...row,
      bespokeCustomerId: match.id,
      bespokeCustomerNumber: match.customerNumber || null,
      bespokeCustomerName: match.name || null,
      packFutbolActive: packCustomerIds.has(match.id),
    }
  })
}

export async function GET(request: Request) {
  const auth = await requireSubscriptionsReadContext()
  if (!auth.ok) return auth.response
  const latam = new URL(request.url).searchParams.get("latam")
  if (latam != null) return readLatamBatch(latam)

  try {
    const client = await createClient()
    const [stored, exclusions] = await Promise.all([
      loadAbnetTvPadronSourceRows(client, auth.companyId),
      loadActiveAbnetTvPadronExclusions(client, auth.companyId),
    ])
    if (stored.error) {
      return NextResponse.json(
        { success: false, message: stored.error.message },
        { status: 400 }
      )
    }
    if (exclusions.error && !exclusions.missing) {
      return NextResponse.json(
        { success: false, message: exclusions.error.message },
        { status: 400 }
      )
    }

    const sourceRows = excludeAbnetPadronRows(
      stored.rows,
      exclusions.exclusions,
      auth.companyId
    )
    const origin = stored.origin

    const presented = withAbnetPadronDuplicates(sourceRows).map(presentAbnetPadronRow)
    const summary = summarizeAbnetTvPadron(presented)
    const customers = await readCustomerMatches(client, auth.companyId)
    const packCustomerIds = customers.error
      ? new Set<string>()
      : await readPackCustomerIds(client, auth.companyId)
    const rows = customers.error
      ? presented
      : attachBespoke(presented, customers.matches, packCustomerIds)

    return NextResponse.json({ success: true, origin, summary, rows })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo leer el padrón de TV.",
      },
      { status: 500 }
    )
  }
}
