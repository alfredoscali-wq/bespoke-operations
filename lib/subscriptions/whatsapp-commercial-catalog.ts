import "server-only"

import { PACK_FUTBOL_CODE, TV_FULL_UPGRADE_CODE } from "@/lib/subscriptions/pack-futbol"
import type { WhatsappCatalogPrices } from "@/lib/subscriptions/whatsapp-commercial-bot"

type QueryResult = {
  data: Record<string, unknown>[] | null
  error: { message: string } | null
}

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: string | boolean) => Query
  in: (column: string, values: string[]) => Query
  is: (column: string, value: null) => Query
  then: PromiseLike<QueryResult>["then"]
}

type Db = {
  from: (table: string) => Query
}

export async function loadWhatsappCatalogPrices(
  client: unknown,
  companyId: string
): Promise<WhatsappCatalogPrices> {
  const db = client as Db
  const result = await db
    .from("isp_commercial_components")
    .select("code, monthly_price, is_active")
    .eq("company_id", companyId)
    .in("code", [PACK_FUTBOL_CODE, TV_FULL_UPGRADE_CODE])
    .is("deleted_at", null)
  if (result.error) {
    return { packMonthlyPrice: null, fullMonthlyPrice: null }
  }
  let packMonthlyPrice: number | null = null
  let fullMonthlyPrice: number | null = null
  for (const row of result.data ?? []) {
    if (row.is_active === false) continue
    const price = numberOrNull(row.monthly_price)
    const code = typeof row.code === "string" ? row.code.trim().toUpperCase() : ""
    if (code === PACK_FUTBOL_CODE) packMonthlyPrice = price
    if (code === TV_FULL_UPGRADE_CODE) fullMonthlyPrice = price
  }
  return { packMonthlyPrice, fullMonthlyPrice }
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
