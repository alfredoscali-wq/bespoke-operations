import "server-only"

import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import { readAbnetTvPadronStatic } from "@/lib/subscriptions/abnet-tv-padron-static"
import {
  abnetPadronCustomerNumber,
  abnetPadronMoney,
  ABNET_TV_PADRON_SOURCE,
  type AbnetTvPadronSourceRow,
} from "@/lib/subscriptions/abnet-tv-padron"
import { BESPOKE_OT_TV_PADRON_SOURCE } from "@/lib/subscriptions/tv-ot-signups"
import type { AbnetPadronExclusion } from "@/lib/subscriptions/abnet-tv-padron-exclusions"

const PAGE = 1000

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  order: (column: string, options?: { ascending: boolean }) => LooseFilter
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

export function padronTableMissing(error: { code?: string; message: string } | null) {
  const message = error?.message ?? ""
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("abnet_tv_padron_rows") ||
    message.includes("abnet_tv_padron_exclusions")
  )
}

export async function loadAbnetTvPadronSourceRows(
  client: unknown,
  companyId: string
): Promise<{
  rows: AbnetTvPadronSourceRow[]
  origin: "table" | "static"
  error: { code?: string; message: string } | null
}> {
  const page = await readPadronSource(client, companyId, ABNET_TV_PADRON_SOURCE)
  if (page.error && !padronTableMissing(page.error)) {
    return { rows: [], origin: "table", error: page.error }
  }
  let rows = (page.rows ?? []).map((row) => mapPadronSourceRow(row, ABNET_TV_PADRON_SOURCE))
  let origin: "table" | "static" = "table"
  if (rows.length === 0 && companyId === BESPOKE_PRODUCTION_COMPANY_ID) {
    rows = readAbnetTvPadronStatic()
    origin = "static"
  }
  const otPage = await readPadronSource(client, companyId, BESPOKE_OT_TV_PADRON_SOURCE)
  if (otPage.error && !padronTableMissing(otPage.error)) {
    return { rows: [], origin: "table", error: otPage.error }
  }
  rows = rows.concat(
    (otPage.rows ?? []).map((row) => mapPadronSourceRow(row, BESPOKE_OT_TV_PADRON_SOURCE))
  )
  return { rows, origin, error: null }
}

const PADRON_COLUMNS =
  "abnet_customer_number, customer_name, service_type, node, plan_name, status, tv_amount, tv_tax_amount, final_amount, source, source_row"

function readPadronSource(client: unknown, companyId: string, source: string) {
  return readPages((from, to) =>
    looseDb(client)
      .from("abnet_tv_padron_rows")
      .select(PADRON_COLUMNS)
      .eq("company_id", companyId)
      .eq("source", source)
      .order("source_row")
      .range(from, to)
  )
}

function mapPadronSourceRow(
  row: Record<string, unknown>,
  fallbackSource: string
): AbnetTvPadronSourceRow {
  return {
    source: text(row.source) || fallbackSource,
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
  }
}

export async function loadActiveAbnetTvPadronExclusions(
  client: unknown,
  companyId: string
): Promise<{
  exclusions: AbnetPadronExclusion[]
  missing: boolean
  error: { code?: string; message: string } | null
}> {
  const page = await readPages((from, to) =>
    looseDb(client)
      .from("abnet_tv_padron_exclusions")
      .select("company_id, source, source_row, abnet_customer_number, deleted_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("source_row", { ascending: true })
      .range(from, to)
  )
  if (page.error) {
    return {
      exclusions: [],
      missing: padronTableMissing(page.error),
      error: page.error,
    }
  }
  return {
    exclusions: (page.rows ?? []).flatMap((row) => {
      const number = abnetPadronCustomerNumber(row.abnet_customer_number)
      const sourceRow = Number(row.source_row)
      if (!number || !Number.isInteger(sourceRow) || sourceRow <= 0) return []
      return [
        {
          companyId: text(row.company_id) || companyId,
          source: text(row.source) || ABNET_TV_PADRON_SOURCE,
          sourceRow,
          abnetCustomerNumber: number,
          deletedAt: row.deleted_at == null ? null : text(row.deleted_at) || null,
        },
      ]
    }),
    missing: false,
    error: null,
  }
}
