import { escapeCustomerSearchPattern } from "@/lib/customers/customer-list"
import { isIspCommercialStatus } from "@/lib/isp/labels"
import {
  canChangeTvPlanCode,
  isTvOnlyCatalogWrite,
  tvPlanWriteDraftToCatalogDraft,
  validateTvPlanWriteDraft,
  TV_PLAN_CODE_LOCKED_MESSAGE,
  TV_PLAN_NOT_TV_CATEGORY_MESSAGE,
  type TvPlanWriteDraft,
} from "@/lib/subscriptions/tv-catalog"
import {
  DEFAULT_TV_LIST_PAGE_SIZE,
  isTvCatalogCategory,
  resolveTvListCommercialIds,
  TV_KPI_ACTIVE_STATUS,
  summarizeTvPlans,
  type TvCommercialServiceOption,
  type TvDeskSummary,
  type TvListStatusFilter,
  type TvSelectedCommercialFilter,
  type TvSelectedPlanFilter,
} from "@/lib/subscriptions/tv-plans"
import type {
  TvCatalogPlan,
  TvSubscriberListPage,
  TvSubscriberRow,
} from "@/lib/types/subscriptions"
import type { Database } from "@/lib/supabase/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createIspCatalogItem,
  setIspCatalogActive,
  updateIspCatalogItem,
} from "@/lib/isp/catalog-queries"

export type SupabaseTvClient = SupabaseClient<Database>

export type TvRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } }

function mapError(error: { code?: string; message: string }) {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

type CatalogRow = {
  id: string
  company_id: string
  code: string | null
  name: string
  monthly_price: number | string | null
  category: string
  requires_connection: boolean
  billing_method: string
  is_active: boolean
}

type CustomerEmbed = {
  id: string
  name: string | null
  phone: string | null
  locality: string | null
  dni: string | null
  customer_number: string | null
} | null

type ServiceListRow = {
  id: string
  company_id: string
  customer_id: string
  catalog_id: string | null
  plan_name: string
  monthly_fee: number | string | null
  commercial_status: string
  activation_date: string | null
  customer: CustomerEmbed | CustomerEmbed[]
  catalog?: {
    code: string | null
    name: string
    monthly_price: number | string | null
    category: string
    tv_plan_catalog_id: string | null
  } | null
}

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function mapCatalogPlan(
  row: CatalogRow,
  usedCount = 0
): TvCatalogPlan | null {
  if (!isTvCatalogCategory(row.category)) return null
  const code = row.code?.trim() ?? ""
  if (!code) return null
  return {
    id: row.id,
    companyId: row.company_id,
    code,
    name: row.name.trim() || code,
    monthlyPrice: toNumber(row.monthly_price),
    category: "tv",
    requiresConnection: row.requires_connection,
    billingMethod: row.billing_method,
    isActive: row.is_active,
    usedCount,
  }
}

async function countTvPlanUsage(
  client: SupabaseTvClient,
  companyId: string,
  planIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (planIds.length === 0) return counts

  const [{ data: services }, { data: tasks }, { data: commercial }] =
    await Promise.all([
      client
        .from("isp_services")
        .select("catalog_id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("catalog_id", planIds),
      client
        .from("tasks")
        .select("service_catalog_id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("service_catalog_id", planIds),
      client
        .from("isp_service_catalog")
        .select("tv_plan_catalog_id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("tv_plan_catalog_id", planIds),
    ])

  for (const row of services ?? []) {
    const id = row.catalog_id
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const row of tasks ?? []) {
    const id = row.service_catalog_id
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const row of commercial ?? []) {
    const id = row.tv_plan_catalog_id
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

type CommercialTvCatalogRow = {
  id: string
  name: string
  tv_plan_catalog_id: string | null
}

async function fetchCommercialCatalogsWithTv(
  client: SupabaseTvClient,
  companyId: string
): Promise<TvRepositoryResult<TvCommercialServiceOption[]>> {
  const { data, error } = await client
    .from("isp_service_catalog")
    .select("id, name, tv_plan_catalog_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .not("tv_plan_catalog_id", "is", null)
    .order("name", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const options: TvCommercialServiceOption[] = []
  for (const row of (data ?? []) as CommercialTvCatalogRow[]) {
    const tvId = row.tv_plan_catalog_id
    if (!tvId) continue
    options.push({
      id: row.id,
      name: row.name.trim() || "Servicio comercial",
      tvPlanCatalogId: tvId,
    })
  }
  return { data: options, error: null }
}

async function commercialCatalogIdsByTvPlan(
  client: SupabaseTvClient,
  companyId: string
): Promise<TvRepositoryResult<Map<string, string[]>>> {
  const catalogs = await fetchCommercialCatalogsWithTv(client, companyId)
  if (catalogs.error || !catalogs.data) {
    return {
      data: null,
      error:
        catalogs.error ?? {
          code: "UNKNOWN",
          message: "No se pudieron leer los componentes TV.",
        },
    }
  }

  const grouped = new Map<string, string[]>()
  for (const row of catalogs.data) {
    const current = grouped.get(row.tvPlanCatalogId) ?? []
    current.push(row.id)
    grouped.set(row.tvPlanCatalogId, current)
  }
  return { data: grouped, error: null }
}

export async function fetchTvCommercialServiceOptions(
  client: SupabaseTvClient,
  companyId: string
): Promise<TvRepositoryResult<TvCommercialServiceOption[]>> {
  return fetchCommercialCatalogsWithTv(client, companyId)
}

export async function fetchTvCatalogPlans(
  client: SupabaseTvClient,
  companyId: string
): Promise<TvRepositoryResult<TvCatalogPlan[]>> {
  const { data, error } = await client
    .from("isp_service_catalog")
    .select(
      "id, company_id, code, name, monthly_price, category, requires_connection, billing_method, is_active"
    )
    .eq("company_id", companyId)
    .eq("category", "tv")
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const rows = (data ?? []) as CatalogRow[]
  const usage = await countTvPlanUsage(
    client,
    companyId,
    rows.map((row) => row.id)
  )
  const plans = rows
    .map((row) => mapCatalogPlan(row, usage.get(row.id) ?? 0))
    .filter((plan): plan is TvCatalogPlan => plan != null)

  return { data: plans, error: null }
}

export async function fetchTvDeskSummary(
  client: SupabaseTvClient,
  companyId: string
): Promise<TvRepositoryResult<TvDeskSummary>> {
  const catalog = await fetchTvCatalogPlans(client, companyId)
  if (catalog.error || !catalog.data) {
    return {
      data: null,
      error:
        catalog.error ?? {
          code: "UNKNOWN",
          message: "Catálogo TV no disponible.",
        },
    }
  }

  const grouped = await commercialCatalogIdsByTvPlan(client, companyId)
  if (grouped.error || !grouped.data) {
    return {
      data: null,
      error:
        grouped.error ?? {
          code: "UNKNOWN",
          message: "No se pudieron leer los componentes TV.",
        },
    }
  }

  const counts = await Promise.all(
    catalog.data.map(async (plan) => {
      const commercialIds = grouped.data.get(plan.id) ?? []
      if (commercialIds.length === 0) {
        return { plan, activeCount: 0, error: null }
      }
      const { count, error } = await client
        .from("isp_services")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("catalog_id", commercialIds)
        .eq("commercial_status", TV_KPI_ACTIVE_STATUS)
        .is("deleted_at", null)

      if (error) {
        return { plan, activeCount: 0, error }
      }
      return { plan, activeCount: count ?? 0, error: null }
    })
  )

  const failed = counts.find((item) => item.error)
  if (failed?.error) {
    return { data: null, error: mapError(failed.error) }
  }

  return {
    data: summarizeTvPlans(
      counts.map((item) => ({
        code: item.plan.code,
        catalogId: item.plan.id,
        name: item.plan.name,
        monthlyPrice: item.plan.monthlyPrice,
        isActive: item.plan.isActive,
        activeCount: item.activeCount,
      }))
    ),
    error: null,
  }
}

function mapListRow(
  row: ServiceListRow,
  tvPlansById: Map<string, TvCatalogPlan>
): TvSubscriberRow | null {
  const embedded = embedOne(row.catalog)
  const tvPlanId = embedded?.tv_plan_catalog_id ?? null
  if (!tvPlanId) return null
  const tvPlan = tvPlansById.get(tvPlanId)
  if (!tvPlan) return null
  if (!isIspCommercialStatus(row.commercial_status)) return null

  const customer = embedOne(row.customer)
  if (!customer) return null

  return {
    serviceId: row.id,
    customerId: row.customer_id,
    companyId: row.company_id,
    customerName: customer.name?.trim() || "Sin nombre",
    phone: customer.phone?.trim() || "",
    locality: customer.locality?.trim() || "",
    dni: customer.dni?.trim() || "",
    customerNumber: customer.customer_number?.trim() || "",
    commercialPlanName: row.plan_name.trim() || embedded?.name || "—",
    commercialCatalogId: row.catalog_id ?? "",
    tvPlanCatalogId: tvPlan.id,
    planCode: tvPlan.code,
    planName: tvPlan.name,
    monthlyPrice: tvPlan.monthlyPrice,
    commercialStatus: row.commercial_status,
    activationDate: row.activation_date,
  }
}

export async function fetchTvSubscriberPage(
  client: SupabaseTvClient,
  input: {
    companyId: string
    plans: TvCatalogPlan[]
    selectedPlan: TvSelectedPlanFilter
    selectedCommercialId?: TvSelectedCommercialFilter
    status: TvListStatusFilter
    search?: string
    page: number
    pageSize?: number
  }
): Promise<TvRepositoryResult<TvSubscriberListPage>> {
  const pageSize = input.pageSize ?? DEFAULT_TV_LIST_PAGE_SIZE
  const page = Math.max(1, input.page)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const tvPlansById = new Map(input.plans.map((plan) => [plan.id, plan]))

  const grouped = await commercialCatalogIdsByTvPlan(client, input.companyId)
  if (grouped.error || !grouped.data) {
    return {
      data: null,
      error:
        grouped.error ?? {
          code: "UNKNOWN",
          message: "No se pudieron leer los componentes TV.",
        },
    }
  }

  const commercialIds = resolveTvListCommercialIds({
    commercialIdsByTvPlan: grouped.data,
    selectedPlan: input.selectedPlan,
    selectedCommercialId: input.selectedCommercialId ?? "all",
  })

  if (commercialIds.length === 0) {
    return {
      data: { items: [], total: 0, page, pageSize },
      error: null,
    }
  }

  let customerIds: string[] | null = null
  const search = input.search?.trim() ?? ""
  if (search) {
    const pattern = escapeCustomerSearchPattern(search)
    const { data: matches, error: searchError } = await client
      .from("customers")
      .select("id")
      .eq("company_id", input.companyId)
      .is("deleted_at", null)
      .or(
        `name.ilike.${pattern},phone.ilike.${pattern},whatsapp.ilike.${pattern},locality.ilike.${pattern},dni.ilike.${pattern},customer_number.ilike.${pattern}`
      )
      .limit(500)

    if (searchError) {
      return { data: null, error: mapError(searchError) }
    }
    customerIds = (matches ?? []).map((row) => row.id)
    if (customerIds.length === 0) {
      return {
        data: { items: [], total: 0, page, pageSize },
        error: null,
      }
    }
  }

  let query = client
    .from("isp_services")
    .select(
      `
      id,
      company_id,
      customer_id,
      catalog_id,
      plan_name,
      monthly_fee,
      commercial_status,
      activation_date,
      customer:customers!isp_services_customer_id_fkey(
        id, name, phone, locality, dni, customer_number
      ),
      catalog:isp_service_catalog!isp_services_catalog_id_fkey(
        code, name, monthly_price, category, tv_plan_catalog_id
      )
    `,
      { count: "exact" }
    )
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .in("catalog_id", commercialIds)
    .order("activation_date", { ascending: false })
    .range(from, to)

  if (customerIds) {
    query = query.in("customer_id", customerIds)
  }

  if (input.status !== "all") {
    query = query.eq("commercial_status", input.status)
  }

  const { data, error, count } = await query
  if (error) {
    return { data: null, error: mapError(error) }
  }

  const items = ((data ?? []) as unknown as ServiceListRow[])
    .map((row) => mapListRow(row, tvPlansById))
    .filter((row): row is TvSubscriberRow => row != null)

  return {
    data: {
      items,
      total: count ?? items.length,
      page,
      pageSize,
    },
    error: null,
  }
}

export async function createTvCatalogPlan(
  client: SupabaseTvClient,
  companyId: string,
  draft: TvPlanWriteDraft
): Promise<TvRepositoryResult<TvCatalogPlan>> {
  const validation = validateTvPlanWriteDraft(draft)
  if (!validation.valid) {
    return {
      data: null,
      error: { code: "VALIDATION", message: validation.message ?? "Datos inválidos." },
    }
  }

  try {
    const item = await createIspCatalogItem(
      client,
      companyId,
      tvPlanWriteDraftToCatalogDraft(draft)
    )
    if (!isTvOnlyCatalogWrite(item.category)) {
      return {
        data: null,
        error: { code: "VALIDATION", message: TV_PLAN_NOT_TV_CATEGORY_MESSAGE },
      }
    }
    return {
      data: {
        id: item.id,
        companyId: item.companyId,
        code: item.code ?? draft.code.trim(),
        name: item.name,
        monthlyPrice: item.monthlyPrice ?? 0,
        category: "tv",
        requiresConnection: item.requiresConnection,
        billingMethod: item.billingMethod,
        isActive: item.isActive,
        usedCount: item.usedCount ?? 0,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: mapError(
        error instanceof Error ? error : { message: "No se pudo crear el plan TV." }
      ),
    }
  }
}

export async function updateTvCatalogPlan(
  client: SupabaseTvClient,
  companyId: string,
  id: string,
  draft: TvPlanWriteDraft
): Promise<TvRepositoryResult<TvCatalogPlan>> {
  const validation = validateTvPlanWriteDraft(draft)
  if (!validation.valid) {
    return {
      data: null,
      error: { code: "VALIDATION", message: validation.message ?? "Datos inválidos." },
    }
  }

  const catalog = await fetchTvCatalogPlans(client, companyId)
  if (catalog.error || !catalog.data) {
    return {
      data: null,
      error: catalog.error ?? { code: "UNKNOWN", message: "Plan TV no encontrado." },
    }
  }
  const current = catalog.data.find((plan) => plan.id === id)
  if (!current) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Plan TV no encontrado." },
    }
  }

  const nextCode = draft.code.trim()
  if (
    nextCode !== current.code &&
    !canChangeTvPlanCode(current.usedCount)
  ) {
    return {
      data: null,
      error: { code: "VALIDATION", message: TV_PLAN_CODE_LOCKED_MESSAGE },
    }
  }

  try {
    const item = await updateIspCatalogItem(
      client,
      companyId,
      id,
      tvPlanWriteDraftToCatalogDraft({
        ...draft,
        code: nextCode !== current.code ? nextCode : current.code,
      })
    )
    if (!isTvOnlyCatalogWrite(item.category)) {
      return {
        data: null,
        error: { code: "VALIDATION", message: TV_PLAN_NOT_TV_CATEGORY_MESSAGE },
      }
    }
    return {
      data: {
        id: item.id,
        companyId: item.companyId,
        code: item.code ?? current.code,
        name: item.name,
        monthlyPrice: item.monthlyPrice ?? 0,
        category: "tv",
        requiresConnection: item.requiresConnection,
        billingMethod: item.billingMethod,
        isActive: item.isActive,
        usedCount: item.usedCount ?? current.usedCount,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: mapError(
        error instanceof Error
          ? error
          : { message: "No se pudo actualizar el plan TV." }
      ),
    }
  }
}

export async function setTvCatalogPlanActive(
  client: SupabaseTvClient,
  companyId: string,
  id: string,
  isActive: boolean
): Promise<TvRepositoryResult<TvCatalogPlan>> {
  const catalog = await fetchTvCatalogPlans(client, companyId)
  if (catalog.error || !catalog.data) {
    return {
      data: null,
      error: catalog.error ?? { code: "UNKNOWN", message: "Plan TV no encontrado." },
    }
  }
  const current = catalog.data.find((plan) => plan.id === id)
  if (!current) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Plan TV no encontrado." },
    }
  }

  try {
    const item = await setIspCatalogActive(client, companyId, id, isActive)
    return {
      data: {
        ...current,
        isActive: item.isActive,
        usedCount: item.usedCount ?? current.usedCount,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: mapError(
        error instanceof Error
          ? error
          : { message: "No se pudo actualizar el estado del plan TV." }
      ),
    }
  }
}
