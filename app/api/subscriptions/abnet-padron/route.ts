import { existsSync } from "node:fs"
import { NextResponse } from "next/server"

import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import { ABNET_TV_PADRON_XLSX_PATH, readAbnetTvPadronWorkbook } from "@/lib/subscriptions/abnet-tv-padron-file"
import {
  abnetPadronCustomerNumber,
  abnetPadronMoney,
  ABNET_TV_PADRON_SOURCE,
  presentAbnetPadronRow,
  summarizeAbnetTvPadron,
  withAbnetPadronDuplicates,
  type AbnetTvPadronRow,
  type AbnetTvPadronSourceRow,
} from "@/lib/subscriptions/abnet-tv-padron"
import { PACK_FUTBOL_CODE } from "@/lib/subscriptions/pack-futbol"
import { requireSubscriptionsReadContext } from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const PAGE = 1000

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

function tableMissing(error: { code?: string; message: string } | null) {
  const message = error?.message ?? ""
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("abnet_tv_padron_rows")
  )
}

async function readStoredPadron(client: unknown, companyId: string) {
  const page = await readPages((from, to) =>
    looseDb(client)
      .from("abnet_tv_padron_rows")
      .select(
        "abnet_customer_number, customer_name, service_type, node, plan_name, status, tv_amount, tv_tax_amount, final_amount, source, source_row"
      )
      .eq("company_id", companyId)
      .eq("source", ABNET_TV_PADRON_SOURCE)
      .order("source_row")
      .range(from, to)
  )
  if (page.error) {
    return {
      rows: [] as AbnetTvPadronSourceRow[],
      missing: tableMissing(page.error),
      error: page.error,
    }
  }
  return {
    rows: (page.rows ?? []).map((row) => ({
      source: text(row.source) || ABNET_TV_PADRON_SOURCE,
      sourceRow: Number(row.source_row),
      abnetCustomerNumber: text(row.abnet_customer_number),
      customerName: text(row.customer_name),
      serviceType: text(row.service_type),
      node: text(row.node),
      planName: text(row.plan_name),
      status: text(row.status),
      tvAmount: abnetPadronMoney(row.tv_amount),
      tvTaxAmount: abnetPadronMoney(row.tv_tax_amount),
      finalAmount: abnetPadronMoney(row.final_amount),
    })),
    missing: false,
    error: null,
  }
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

export async function GET() {
  const auth = await requireSubscriptionsReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const stored = await readStoredPadron(client, auth.companyId)
    if (stored.error && !stored.missing) {
      return NextResponse.json(
        { success: false, message: stored.error.message },
        { status: 400 }
      )
    }

    let sourceRows = stored.rows
    let origin: "table" | "excel" = "table"
    if (
      sourceRows.length === 0 &&
      auth.companyId === BESPOKE_PRODUCTION_COMPANY_ID &&
      existsSync(ABNET_TV_PADRON_XLSX_PATH)
    ) {
      sourceRows = readAbnetTvPadronWorkbook()
      origin = "excel"
    }

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
