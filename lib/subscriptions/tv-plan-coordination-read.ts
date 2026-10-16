import "server-only"

import { PACK_FUTBOL_CODE, TV_FULL_UPGRADE_CODE } from "@/lib/subscriptions/pack-futbol"
import type { TvPlanComponentFact, TvPlanServiceFact } from "@/lib/subscriptions/tv-plan-coordination"

type QueryResult = {
  data: Record<string, unknown>[] | null
  error: { message: string } | null
}

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: string) => Query
  in: (column: string, values: string[]) => Query
  is: (column: string, value: null) => Query
  then: PromiseLike<QueryResult>["then"]
}

type Db = {
  from: (table: string) => Query
}

export async function loadTvPlanCommercialServices(
  client: unknown,
  companyId: string,
  customerId: string
): Promise<TvPlanServiceFact[]> {
  const db = client as Db
  const services = await read(db, "isp_services", "id, list_price, catalog_id", (query) =>
    query
      .eq("company_id", companyId)
      .eq("customer_id", customerId)
      .eq("commercial_status", "active")
      .is("deleted_at", null)
  )
  const serviceIds = services.map((row) => text(row.id)).filter(Boolean)
  if (serviceIds.length === 0) return []

  const catalogIds = [...new Set(services.map((row) => text(row.catalog_id)).filter(Boolean))]
  const catalogs = catalogIds.length
    ? await read(db, "isp_service_catalog", "id, monthly_price, tv_plan_catalog_id", (query) =>
        query.eq("company_id", companyId).in("id", catalogIds).is("deleted_at", null)
      )
    : []
  const tvIds = [...new Set(catalogs.map((row) => text(row.tv_plan_catalog_id)).filter(Boolean))]
  const tvPlans = tvIds.length
    ? await read(db, "isp_service_catalog", "id, code", (query) =>
        query.eq("company_id", companyId).in("id", tvIds).is("deleted_at", null)
      )
    : []
  const assignments = await read(
    db,
    "isp_service_components",
    "service_id, component_id, unit_price, is_recurring",
    (query) =>
      query
        .eq("company_id", companyId)
        .in("service_id", serviceIds)
        .eq("status", "active")
        .is("deleted_at", null)
  )
  const componentIds = [...new Set(assignments.map((row) => text(row.component_id)).filter(Boolean))]
  const components = componentIds.length
    ? await read(db, "isp_commercial_components", "id, code", (query) =>
        query.eq("company_id", companyId).in("id", componentIds).is("deleted_at", null)
      )
    : []
  const catalogComponents = await read(
    db,
    "isp_commercial_components",
    "code, monthly_price, is_recurring, is_active",
    (query) => query.eq("company_id", companyId).is("deleted_at", null)
  )
  const conditions = await read(
    db,
    "isp_service_conditions",
    "service_id, condition_id, discount_percent",
    (query) =>
      query
        .eq("company_id", companyId)
        .in("service_id", serviceIds)
        .eq("status", "active")
        .is("deleted_at", null)
  )
  const conditionIds = [...new Set(conditions.map((row) => text(row.condition_id)).filter(Boolean))]
  const conditionCatalog = conditionIds.length
    ? await read(db, "isp_commercial_conditions", "id, code", (query) =>
        query.eq("company_id", companyId).in("id", conditionIds).is("deleted_at", null)
      )
    : []

  const catalogById = new Map(catalogs.map((row) => [text(row.id), row]))
  const tvCodeById = new Map(tvPlans.map((row) => [text(row.id), text(row.code)]))
  const codeByComponentId = new Map(components.map((row) => [text(row.id), text(row.code)]))
  const conditionCodeById = new Map(conditionCatalog.map((row) => [text(row.id), text(row.code)]))

  return services.flatMap((row) => {
    const serviceId = text(row.id)
    if (!serviceId) return []
    const catalog = catalogById.get(text(row.catalog_id))
    const tvId = text(catalog?.tv_plan_catalog_id)
    const condition = conditions.find((item) => text(item.service_id) === serviceId)
    const activeComponents = assignments.flatMap((item) => {
      if (text(item.service_id) !== serviceId) return []
      const code = codeByComponentId.get(text(item.component_id))
      const unitPrice = number(item.unit_price)
      if (!code || unitPrice == null) return []
      return [{ code, unitPrice, isRecurring: item.is_recurring === true }]
    })
    return [
      {
        serviceId,
        includedTvCode: tvId ? tvCodeById.get(tvId) ?? null : null,
        listPrice: number(row.list_price),
        catalogMonthlyPrice: number(catalog?.monthly_price),
        conditionCode: condition ? conditionCodeById.get(text(condition.condition_id)) ?? null : null,
        discountPercent: condition ? number(condition.discount_percent) : null,
        activeComponents,
        catalogComponents: catalogFacts(catalogComponents),
      },
    ]
  })
}

function catalogFacts(rows: Record<string, unknown>[]): TvPlanComponentFact[] {
  return rows.flatMap((row) => {
    const code = text(row.code)
    const unitPrice = number(row.monthly_price)
    if (!code || unitPrice == null || row.is_active === false) return []
    if (code !== PACK_FUTBOL_CODE && code !== TV_FULL_UPGRADE_CODE) return []
    return [{ code, unitPrice, isRecurring: row.is_recurring !== false }]
  })
}

async function read(
  client: Db,
  table: string,
  columns: string,
  filter: (query: Query) => Query
): Promise<Record<string, unknown>[]> {
  const result = await filter(client.from(table).select(columns))
  if (result.error) throw new Error("No se pudo leer el servicio comercial.")
  return result.data ?? []
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
