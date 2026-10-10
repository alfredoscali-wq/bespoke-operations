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
  canOfferPackFutbol,
  commercialTvTier,
  PACK_FUTBOL_CODE,
  TV_FULL_UPGRADE_CODE,
} from "@/lib/subscriptions/pack-futbol"
import {
  classifyCommercialTvSubscription,
  commercialDeskMonthlyFee,
  customerExternalNumber,
  summarizeTvCommercialDesk,
  TV_BASICO_INCLUDED_CODE,
  type TvCommercialDeskSummary,
} from "@/lib/subscriptions/tv-commercial-desk"
import {
  DEFAULT_TV_LIST_PAGE_SIZE,
  isTvCatalogCategory,
  resolveTvListCommercialIds,
  type TvCommercialServiceOption,
  type TvListStatusFilter,
  type TvSelectedCommercialFilter,
  type TvSelectedPlanFilter,
} from "@/lib/subscriptions/tv-plans"
import type {
  TvCatalogPlan,
  TvSubscriberListPage,
  TvSubscriberRow,
} from "@/lib/types/subscriptions"

export type { TvCommercialDeskSummary }
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

const TV_DESK_PAGE = 1000

type DeskServiceRow = {
  id: string
  company_id: string
  customer_id: string
  catalog_id: string | null
  plan_name: string
  list_price: number | string | null
  commercial_status: string
  activation_date: string | null
  customer:
    | {
        id: string
        name: string | null
        phone: string | null
        locality: string | null
        dni: string | null
        customer_number: string | null
        external_customer_code: string | null
      }
    | {
        id: string
        name: string | null
        phone: string | null
        locality: string | null
        dni: string | null
        customer_number: string | null
        external_customer_code: string | null
      }[]
    | null
  catalog:
    | {
        code: string | null
        name: string
        monthly_price: number | string | null
        category: string
        tv_plan_catalog_id: string | null
      }
    | {
        code: string | null
        name: string
        monthly_price: number | string | null
        category: string
        tv_plan_catalog_id: string | null
      }[]
    | null
}

async function readAllRanges<T>(
  read: (
    from: number,
    to: number
  ) => Promise<{
    data: T[] | null
    error: { code?: string; message: string } | null
  }>
): Promise<TvRepositoryResult<T[]>> {
  const rows: T[] = []
  for (let from = 0; ; from += TV_DESK_PAGE) {
    const { data, error } = await read(from, from + TV_DESK_PAGE - 1)
    if (error) return { data: null, error: mapError(error) }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < TV_DESK_PAGE) break
  }
  return { data: rows, error: null }
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

export async function fetchTvCommercialDeskRows(
  client: SupabaseTvClient,
  companyId: string
): Promise<TvRepositoryResult<TvSubscriberRow[]>> {
  const tvCatalog = await client
    .from("isp_service_catalog")
    .select("id, code")
    .eq("company_id", companyId)
    .eq("category", "tv")
    .is("deleted_at", null)

  if (tvCatalog.error) {
    return { data: null, error: mapError(tvCatalog.error) }
  }

  const tvCodeById = new Map<string, string>()
  const basicoIds: string[] = []
  for (const row of tvCatalog.data ?? []) {
    const code = row.code?.trim().toUpperCase() ?? ""
    if (!code) continue
    tvCodeById.set(row.id, code)
    if (code === TV_BASICO_INCLUDED_CODE) basicoIds.push(row.id)
  }

  const commercialIds: string[] = []
  if (basicoIds.length > 0) {
    for (const ids of chunk(basicoIds, 100)) {
      const commercial = await client
        .from("isp_service_catalog")
        .select("id")
        .eq("company_id", companyId)
        .in("tv_plan_catalog_id", ids)
        .is("deleted_at", null)
      if (commercial.error) {
        return { data: null, error: mapError(commercial.error) }
      }
      for (const row of commercial.data ?? []) commercialIds.push(row.id)
    }
  }

  const services: DeskServiceRow[] = []
  for (const ids of chunk(commercialIds, 100)) {
    const page = await readAllRanges<DeskServiceRow>(async (from, to) => {
      const { data, error } = await client
        .from("isp_services")
        .select(
          `
          id,
          company_id,
          customer_id,
          catalog_id,
          plan_name,
          list_price,
          commercial_status,
          activation_date,
          customer:customers!isp_services_customer_id_fkey(
            id, name, phone, locality, dni, customer_number, external_customer_code
          ),
          catalog:isp_service_catalog!isp_services_catalog_id_fkey(
            code, name, monthly_price, category, tv_plan_catalog_id
          )
        `
        )
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("catalog_id", ids)
        .order("activation_date", { ascending: false })
        .range(from, to)
      return {
        data: (data ?? []) as unknown as DeskServiceRow[],
        error,
      }
    })
    if (page.error || !page.data) {
      return {
        data: null,
        error: page.error ?? {
          code: "UNKNOWN",
          message: "No se pudieron leer los abonos con TV.",
        },
      }
    }
    services.push(...page.data)
  }

  const db = commercialComponentDb(client)
  const componentCatalog = await db
    .from("isp_commercial_components")
    .select("id, code, monthly_price, is_active")
    .eq("company_id", companyId)
    .is("deleted_at", null)
  if (componentCatalog.error) {
    return { data: null, error: mapError(componentCatalog.error) }
  }
  const componentCodeById = new Map<string, string>()
  let packOfferPrice: number | null = null
  for (const row of componentCatalog.data ?? []) {
    const id = textValue(row.id)
    const code = textValue(row.code).toUpperCase()
    if (!id || !code) continue
    componentCodeById.set(id, code)
    if (code === PACK_FUTBOL_CODE && row.is_active === true) {
      const price = moneyValue(row.monthly_price)
      if (price != null && price >= 0) packOfferPrice = price
    }
  }

  const assignments = await readAllRanges<Record<string, unknown>>(
    async (from, to) => {
      const query = db
        .from("isp_service_components")
        .select("service_id, component_id, unit_price, is_recurring")
        .eq("company_id", companyId)
        .eq("status", "active")
        .is("deleted_at", null)
      return (query as unknown as {
        order: (column: string) => {
          range: (
            from: number,
            to: number
          ) => Promise<{
            data: Record<string, unknown>[] | null
            error: { code?: string; message: string } | null
          }>
        }
      })
        .order("id")
        .range(from, to)
    }
  )
  if (assignments.error || !assignments.data) {
    return {
      data: null,
      error:
        assignments.error ?? {
          code: "UNKNOWN",
          message: "No se pudieron leer los componentes comerciales.",
        },
    }
  }

  const componentsByService = new Map<
    string,
    { codes: string[]; prices: { unitPrice: number; isRecurring: boolean }[] }
  >()
  for (const row of assignments.data) {
    const serviceId = textValue(row.service_id)
    const code = componentCodeById.get(textValue(row.component_id))
    const unitPrice = moneyValue(row.unit_price)
    if (!serviceId || !code || unitPrice == null) continue
    const current = componentsByService.get(serviceId) ?? {
      codes: [],
      prices: [],
    }
    current.codes.push(code)
    current.prices.push({
      unitPrice,
      isRecurring: row.is_recurring !== false,
    })
    componentsByService.set(serviceId, current)
  }

  const loadedIds = new Set(services.map((service) => service.id))
  const extraIds = [...componentsByService.entries()]
    .filter(
      ([serviceId, assignment]) =>
        !loadedIds.has(serviceId) &&
        assignment.codes.some((code) => code === TV_FULL_UPGRADE_CODE)
    )
    .map(([serviceId]) => serviceId)

  for (const ids of chunk(extraIds, 100)) {
    const extra = await client
      .from("isp_services")
      .select(
        `
        id,
        company_id,
        customer_id,
        catalog_id,
        plan_name,
        list_price,
        commercial_status,
        activation_date,
        customer:customers!isp_services_customer_id_fkey(
          id, name, phone, locality, dni, customer_number, external_customer_code
        ),
        catalog:isp_service_catalog!isp_services_catalog_id_fkey(
          code, name, monthly_price, category, tv_plan_catalog_id
        )
      `
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("id", ids)
    if (extra.error) return { data: null, error: mapError(extra.error) }
    services.push(...((extra.data ?? []) as unknown as DeskServiceRow[]))
  }

  const conditionCatalog = await db
    .from("isp_commercial_conditions")
    .select("id, code, name")
    .eq("company_id", companyId)
    .is("deleted_at", null)
  if (conditionCatalog.error) {
    return { data: null, error: mapError(conditionCatalog.error) }
  }
  const conditionById = new Map<string, { code: string; name: string }>()
  for (const row of conditionCatalog.data ?? []) {
    const id = textValue(row.id)
    const code = textValue(row.code).toUpperCase()
    if (!id || !code) continue
    conditionById.set(id, { code, name: textValue(row.name) || code })
  }

  const conditionAssignments = await readAllRanges<Record<string, unknown>>(
    async (from, to) => {
      const query = db
        .from("isp_service_conditions")
        .select("service_id, condition_id, discount_percent")
        .eq("company_id", companyId)
        .eq("status", "active")
        .is("deleted_at", null)
      return (query as unknown as {
        order: (column: string) => {
          range: (
            from: number,
            to: number
          ) => Promise<{
            data: Record<string, unknown>[] | null
            error: { code?: string; message: string } | null
          }>
        }
      })
        .order("id")
        .range(from, to)
    }
  )
  if (conditionAssignments.error || !conditionAssignments.data) {
    return {
      data: null,
      error:
        conditionAssignments.error ?? {
          code: "UNKNOWN",
          message: "No se pudieron leer las condiciones comerciales.",
        },
    }
  }
  const conditionByService = new Map<
    string,
    { code: string; name: string; discountPercent: number }
  >()
  for (const row of conditionAssignments.data) {
    const serviceId = textValue(row.service_id)
    const condition = conditionById.get(textValue(row.condition_id))
    const discountPercent = moneyValue(row.discount_percent)
    if (!serviceId || !condition || discountPercent == null) continue
    conditionByService.set(serviceId, {
      code: condition.code,
      name: condition.name,
      discountPercent,
    })
  }

  const items: TvSubscriberRow[] = []
  for (const service of services) {
    if (!isIspCommercialStatus(service.commercial_status)) continue
    const customer = embedOne(service.customer)
    const catalog = embedOne(service.catalog)
    if (!customer) continue
    const includedTvCode =
      tvCodeById.get(catalog?.tv_plan_catalog_id ?? "") ?? null
    const assignment = componentsByService.get(service.id) ?? {
      codes: [],
      prices: [],
    }
    const condition = conditionByService.get(service.id) ?? null
    const classification = classifyCommercialTvSubscription({
      includedTvCode,
      activeComponentCodes: assignment.codes,
      conditionCode: condition?.code ?? null,
    })
    if (!classification.represented) continue
    const packIndex = assignment.codes.findIndex(
      (code) => code === PACK_FUTBOL_CODE
    )
    const packUnitPrice =
      packIndex >= 0 ? assignment.prices[packIndex]?.unitPrice ?? null : null
    const commercialMonthlyFee = commercialDeskMonthlyFee({
      listPrice: moneyValue(service.list_price),
        catalogMonthlyPrice: moneyValue(catalog?.monthly_price),
      components: assignment.prices,
      discountPercent: condition?.discountPercent ?? null,
    })
    items.push({
      serviceId: service.id,
      customerId: service.customer_id,
      companyId: service.company_id,
      customerName: customer.name?.trim() || "Sin nombre",
      phone: customer.phone?.trim() || "",
      locality: customer.locality?.trim() || "",
      dni: customer.dni?.trim() || "",
      customerNumber: customer.customer_number?.trim() || "",
      commercialPlanName: service.plan_name.trim() || catalog?.name || "—",
      commercialCatalogId: service.catalog_id ?? "",
      tvPlanCatalogId: catalog?.tv_plan_catalog_id ?? "",
      planCode: includedTvCode ?? "",
      planName: classification.tier === "full" ? "TV Full" : "TV Básica",
      monthlyPrice: commercialMonthlyFee ?? 0,
      commercialStatus: service.commercial_status,
      activationDate: service.activation_date,
      tvTier: classification.tier,
      packFutbolActive: classification.packFutbol,
      packFutbolMonthlyPrice: classification.packFutbol
        ? packUnitPrice
        : packOfferPrice,
      packFutbolEligible: canOfferPackFutbol({
        tier: classification.tier,
        packFutbolActive: classification.packFutbol,
        packPrice: classification.packFutbol ? null : packOfferPrice,
      }),
      externalCustomerNumber: customerExternalNumber(
        customer.external_customer_code
      ),
      commercialMonthlyFee,
      conditionCode: condition?.code ?? null,
      conditionName: condition?.name ?? null,
      jubilado: classification.jubilado,
    })
  }

  return { data: items, error: null }
}

export async function fetchTvDeskSummary(
  client: SupabaseTvClient,
  companyId: string
): Promise<TvRepositoryResult<TvCommercialDeskSummary>> {
  const rows = await fetchTvCommercialDeskRows(client, companyId)
  if (rows.error || !rows.data) {
    return {
      data: null,
      error:
        rows.error ?? {
          code: "UNKNOWN",
          message: "No se pudo resumir la TV comercial.",
        },
    }
  }
  return { data: summarizeTvCommercialDesk(rows.data), error: null }
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

  return withPackFutbol(
    {
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
    },
    { codes: [], offerPrice: null, activePackPrice: null }
  )
}

function withPackFutbol(
  row: Omit<
    TvSubscriberRow,
    | "tvTier"
    | "packFutbolActive"
    | "packFutbolMonthlyPrice"
    | "packFutbolEligible"
    | "externalCustomerNumber"
    | "commercialMonthlyFee"
    | "conditionCode"
    | "conditionName"
    | "jubilado"
  >,
  input: {
    codes: readonly string[]
    offerPrice: number | null
    activePackPrice: number | null
  }
): TvSubscriberRow {
  const tvTier = commercialTvTier({
    includedTvCode: row.planCode,
    activeComponentCodes: input.codes,
  })
  const packFutbolActive = input.codes.some(
    (code) => code.trim().toUpperCase() === PACK_FUTBOL_CODE
  )
  return {
    ...row,
    tvTier,
    packFutbolActive,
    packFutbolMonthlyPrice: packFutbolActive
      ? input.activePackPrice
      : input.offerPrice,
    packFutbolEligible: canOfferPackFutbol({
      tier: tvTier,
      packFutbolActive,
      packPrice: packFutbolActive ? null : input.offerPrice,
    }),
    externalCustomerNumber: null,
    commercialMonthlyFee: null,
    conditionCode: null,
    conditionName: null,
    jubilado: false,
  }
}

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
  in: (column: string, values: readonly string[]) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  then: PromiseLike<{
    data: Record<string, unknown>[] | null
    error: { code?: string; message: string } | null
  }>["then"]
}

function commercialComponentDb(client: SupabaseTvClient) {
  return client as unknown as {
    from: (table: string) => {
      select: (columns: string) => LooseFilter
    }
  }
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function moneyValue(value: unknown): number | null {
  if (value == null || value === "") return null
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

async function enrichTvRowsWithPackFutbol(
  client: SupabaseTvClient,
  companyId: string,
  items: TvSubscriberRow[]
): Promise<TvRepositoryResult<TvSubscriberRow[]>> {
  if (items.length === 0) return { data: items, error: null }

  const components = await commercialComponentDb(client)
    .from("isp_commercial_components")
    .select("id, code, monthly_price, is_active")
    .eq("company_id", companyId)
    .in("code", [PACK_FUTBOL_CODE, TV_FULL_UPGRADE_CODE])
    .is("deleted_at", null)

  if (components.error) {
    return { data: null, error: mapError(components.error) }
  }

  const catalog = new Map<
    string,
    { code: string; monthlyPrice: number | null; isActive: boolean }
  >()
  for (const row of components.data ?? []) {
    const id = textValue(row.id)
    const code = textValue(row.code).toUpperCase()
    if (!id || !code) continue
    catalog.set(id, {
      code,
      monthlyPrice: moneyValue(row.monthly_price),
      isActive: row.is_active === true,
    })
  }

  const pack = [...catalog.values()].find(
    (item) => item.code === PACK_FUTBOL_CODE && item.isActive
  )
  const offerPrice =
    pack?.monthlyPrice != null && pack.monthlyPrice >= 0
      ? pack.monthlyPrice
      : null

  const assignmentsByService = new Map<
    string,
    { codes: string[]; activePackPrice: number | null }
  >()
  const componentIds = [...catalog.keys()]
  if (componentIds.length > 0) {
    const assignments = await commercialComponentDb(client)
      .from("isp_service_components")
      .select("service_id, component_id, unit_price")
      .eq("company_id", companyId)
      .in(
        "service_id",
        items.map((item) => item.serviceId)
      )
      .in("component_id", componentIds)
      .eq("status", "active")
      .is("deleted_at", null)

    if (assignments.error) {
      return { data: null, error: mapError(assignments.error) }
    }

    for (const row of assignments.data ?? []) {
      const serviceId = textValue(row.service_id)
      const component = catalog.get(textValue(row.component_id))
      if (!serviceId || !component) continue
      const current = assignmentsByService.get(serviceId) ?? {
        codes: [],
        activePackPrice: null,
      }
      current.codes.push(component.code)
      if (component.code === PACK_FUTBOL_CODE) {
        current.activePackPrice = moneyValue(row.unit_price)
      }
      assignmentsByService.set(serviceId, current)
    }
  }

  return {
    data: items.map((item) => {
      const assignment = assignmentsByService.get(item.serviceId)
      return withPackFutbol(item, {
        codes: assignment?.codes ?? [],
        offerPrice,
        activePackPrice: assignment?.activePackPrice ?? null,
      })
    }),
    error: null,
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

  const enriched = await enrichTvRowsWithPackFutbol(
    client,
    input.companyId,
    items
  )
  if (enriched.error || !enriched.data) {
    return {
      data: null,
      error:
        enriched.error ?? {
          code: "UNKNOWN",
          message: "No se pudo leer Pack Fútbol.",
        },
    }
  }

  return {
    data: {
      items: enriched.data,
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
