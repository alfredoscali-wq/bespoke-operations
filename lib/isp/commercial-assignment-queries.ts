import {
  ISP_COMMERCIAL_COMPONENT_TYPES,
  type IspCommercialCompatibility,
  type IspCommercialComponentType,
} from "@/lib/isp/commercial-pricing"
import type { IspQueriesClient } from "@/lib/isp/queries"
import {
  ISP_COMMERCIAL_COMPONENT_NOT_ASSIGNED,
  ISP_COMMERCIAL_CONDITION_NOT_ASSIGNED,
  createIspCommercialAssignmentService,
  type IspActiveCommercialComponent,
  type IspActiveCommercialCondition,
  type IspCommercialAssignmentGateway,
  type IspCommercialBasePlan,
  type IspCommercialComponentRecord,
  type IspCommercialConditionRecord,
  type IspCommercialPersistedPrice,
  type IspCommercialServiceSnapshot,
} from "@/lib/isp/commercial-assignment"

type QueryError = { message: string } | null

type RowQuery = {
  select: (columns: string) => RowQuery
  eq: (column: string, value: string) => RowQuery
  is: (column: string, value: null) => RowQuery
  order: (column: string) => RowQuery
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: QueryError }>
  then: PromiseLike<{ data: Record<string, unknown>[] | null; error: QueryError }>["then"]
}

type CommercialDb = {
  from: (table: string) => {
    select: (columns: string) => RowQuery
    insert: (values: Record<string, unknown>) => Promise<{ error: QueryError }>
    update: (values: Record<string, unknown>) => RowQuery
  }
}

function commercialDb(client: IspQueriesClient): CommercialDb {
  return client as unknown as CommercialDb
}

function throwIfError(error: QueryError) {
  if (error) throw new Error(error.message)
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text ? text : null
}

function asCompatibility(value: unknown): IspCommercialCompatibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const row = value as Record<string, unknown>
  const compatibility: IspCommercialCompatibility = {}
  if (row.category === "internet") compatibility.category = "internet"
  if (typeof row.requiresIncludedTv === "boolean") {
    compatibility.requiresIncludedTv = row.requiresIncludedTv
  }
  if (typeof row.includedTvCode === "string" && row.includedTvCode.trim()) {
    compatibility.includedTvCode = row.includedTvCode.trim()
  }
  return compatibility
}

function asComponentType(value: unknown): IspCommercialComponentType | null {
  if (
    typeof value === "string" &&
    (ISP_COMMERCIAL_COMPONENT_TYPES as readonly string[]).includes(value)
  ) {
    return value as IspCommercialComponentType
  }
  return null
}

async function rowsOf(query: RowQuery): Promise<Record<string, unknown>[]> {
  const { data, error } = await query
  throwIfError(error)
  return data ?? []
}

function mapComponent(row: Record<string, unknown>): IspCommercialComponentRecord | null {
  const id = asText(row.id)
  const code = asText(row.code)
  const name = asText(row.name)
  const componentType = asComponentType(row.component_type)
  if (!id || !code || !name || !componentType) return null
  return {
    id,
    code,
    name,
    description: asText(row.description),
    componentType,
    monthlyPrice: asNumber(row.monthly_price),
    currency: asText(row.currency) ?? "ARS",
    isRecurring: row.is_recurring !== false,
    isActive: row.is_active === true,
    compatibility: asCompatibility(row.compatibility),
    exclusiveGroup: asText(row.exclusive_group),
    tvPlanCatalogId: asText(row.tv_plan_catalog_id),
  }
}

function mapCondition(row: Record<string, unknown>): IspCommercialConditionRecord | null {
  const id = asText(row.id)
  const code = asText(row.code)
  const name = asText(row.name)
  const discountPercent = asNumber(row.discount_percent)
  if (!id || !code || !name || discountPercent == null) return null
  return {
    id,
    code,
    name,
    description: asText(row.description),
    discountPercent,
    isActive: row.is_active === true,
  }
}

/**
 * Assignment writes. price_subtotal, discount_amount and monthly_fee are
 * stored by apply_isp_service_commercial_price when the assignment changes.
 */
export function createSupabaseCommercialAssignmentGateway(
  client: IspQueriesClient
): IspCommercialAssignmentGateway {
  const db = commercialDb(client)
  const services = () => client.from("isp_services")
  const catalog = () => client.from("isp_service_catalog")

  return {
    async load(companyId, serviceId): Promise<IspCommercialServiceSnapshot | null> {
      const { data, error } = await services()
        .select("*")
        .eq("company_id", companyId)
        .eq("id", serviceId)
        .is("deleted_at", null)
        .maybeSingle()
      throwIfError(error)
      if (!data) return null

      const service = data as typeof data & {
        catalog_id: string | null
        list_price: number | null
      }
      const base = await loadBase(catalog, companyId, service.catalog_id)
      const [components, conditions, activeComponents, activeCondition] =
        await Promise.all([
          loadComponents(db, companyId),
          loadConditions(db, companyId),
          loadActiveComponents(db, companyId, serviceId),
          loadActiveCondition(db, companyId, serviceId),
        ])

      return {
        serviceId,
        catalogId: service.catalog_id,
        listPrice: asNumber(service.list_price),
        base,
        components,
        conditions,
        activeComponents: hydrateComponents(activeComponents, components),
        activeCondition: hydrateCondition(activeCondition, conditions),
      }
    },

    async insertComponentAssignment(input) {
      const { error } = await db.from("isp_service_components").insert({
        company_id: input.companyId,
        service_id: input.serviceId,
        component_id: input.componentId,
        unit_price: input.unitPrice,
        is_recurring: input.isRecurring,
        status: "active",
      })
      throwIfError(error)
    },

    async cancelComponentAssignment(input) {
      const { data, error } = await db
        .from("isp_service_components")
        .update({ status: "cancelled" })
        .eq("company_id", input.companyId)
        .eq("service_id", input.serviceId)
        .eq("id", input.assignmentId)
        .eq("status", "active")
        .is("deleted_at", null)
        .select("id")
      throwIfError(error)
      if (!data?.length) throw new Error(ISP_COMMERCIAL_COMPONENT_NOT_ASSIGNED)
    },

    async insertConditionAssignment(input) {
      const { error } = await db.from("isp_service_conditions").insert({
        company_id: input.companyId,
        service_id: input.serviceId,
        condition_id: input.conditionId,
        discount_percent: input.discountPercent,
        status: "active",
      })
      throwIfError(error)
    },

    async cancelConditionAssignment(input) {
      const { data, error } = await db
        .from("isp_service_conditions")
        .update({ status: "cancelled" })
        .eq("company_id", input.companyId)
        .eq("service_id", input.serviceId)
        .eq("id", input.assignmentId)
        .eq("status", "active")
        .is("deleted_at", null)
        .select("id")
      throwIfError(error)
      if (!data?.length) {
        throw new Error(ISP_COMMERCIAL_CONDITION_NOT_ASSIGNED)
      }
    },

    async readPrice(companyId, serviceId): Promise<IspCommercialPersistedPrice | null> {
      const { data, error } = await services()
        .select("*")
        .eq("company_id", companyId)
        .eq("id", serviceId)
        .is("deleted_at", null)
        .maybeSingle()
      throwIfError(error)
      if (!data) return null

      const row = data as typeof data & {
        catalog_id: string | null
        price_subtotal: number | null
        discount_amount: number | null
        monthly_fee: number | null
      }
      const priceSubtotal = asNumber(row.price_subtotal)
      const discountAmount = asNumber(row.discount_amount)
      const monthlyFee = asNumber(row.monthly_fee)
      if (priceSubtotal == null || discountAmount == null || monthlyFee == null) {
        return null
      }

      return {
        serviceId,
        catalogId: row.catalog_id,
        priceSubtotal,
        discountAmount,
        monthlyFee,
      }
    },
  }
}

export function createIspCommercialAssignmentQueries(client: IspQueriesClient) {
  return createIspCommercialAssignmentService(
    createSupabaseCommercialAssignmentGateway(client)
  )
}

async function loadBase(
  catalog: () => ReturnType<IspQueriesClient["from"]>,
  companyId: string,
  catalogId: string | null
): Promise<IspCommercialBasePlan | null> {
  if (!catalogId) return null
  const { data, error } = await catalog()
    .select("id, category, monthly_price, tv_plan_catalog_id")
    .eq("company_id", companyId)
    .eq("id", catalogId)
    .is("deleted_at", null)
    .maybeSingle()
  throwIfError(error)
  if (!data) return null

  let includedTvCode: string | null = null
  if (data.tv_plan_catalog_id) {
    const tv = await catalog()
      .select("code")
      .eq("company_id", companyId)
      .eq("id", data.tv_plan_catalog_id)
      .is("deleted_at", null)
      .maybeSingle()
    throwIfError(tv.error)
    includedTvCode = asText(tv.data?.code ?? null)
  }

  return {
    category: asText(data.category),
    monthlyPrice: asNumber(data.monthly_price),
    includedTvCode,
  }
}

async function loadComponents(
  db: CommercialDb,
  companyId: string
): Promise<IspCommercialComponentRecord[]> {
  const rows = await rowsOf(
    db
      .from("isp_commercial_components")
      .select(
        "id, code, name, description, component_type, monthly_price, currency, is_recurring, is_active, compatibility, exclusive_group, tv_plan_catalog_id"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("code")
  )
  return rows.flatMap((row) => {
    const component = mapComponent(row)
    return component ? [component] : []
  })
}

async function loadConditions(
  db: CommercialDb,
  companyId: string
): Promise<IspCommercialConditionRecord[]> {
  const rows = await rowsOf(
    db
      .from("isp_commercial_conditions")
      .select("id, code, name, description, discount_percent, is_active")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("code")
  )
  return rows.flatMap((row) => {
    const condition = mapCondition(row)
    return condition ? [condition] : []
  })
}

async function loadActiveComponents(
  db: CommercialDb,
  companyId: string,
  serviceId: string
) {
  return rowsOf(
    db
      .from("isp_service_components")
      .select("id, component_id, unit_price, is_recurring, status")
      .eq("company_id", companyId)
      .eq("service_id", serviceId)
      .eq("status", "active")
      .is("deleted_at", null)
  )
}

async function loadActiveCondition(
  db: CommercialDb,
  companyId: string,
  serviceId: string
) {
  const rows = await rowsOf(
    db
      .from("isp_service_conditions")
      .select("id, condition_id, discount_percent, status")
      .eq("company_id", companyId)
      .eq("service_id", serviceId)
      .eq("status", "active")
      .is("deleted_at", null)
  )
  return rows[0] ?? null
}

function hydrateComponents(
  rows: Record<string, unknown>[],
  components: readonly IspCommercialComponentRecord[]
): IspActiveCommercialComponent[] {
  return rows.flatMap((row) => {
    const assignmentId = asText(row.id)
    const componentId = asText(row.component_id)
    const unitPrice = asNumber(row.unit_price)
    const component = components.find((item) => item.id === componentId)
    if (!assignmentId || !componentId || unitPrice == null || !component) return []
    return [
      {
        assignmentId,
        componentId,
        code: component.code,
        name: component.name,
        componentType: component.componentType,
        unitPrice,
        isRecurring: row.is_recurring !== false,
        exclusiveGroup: component.exclusiveGroup,
        status: "active" as const,
      },
    ]
  })
}

function hydrateCondition(
  row: Record<string, unknown> | null,
  conditions: readonly IspCommercialConditionRecord[]
): IspActiveCommercialCondition | null {
  if (!row) return null
  const assignmentId = asText(row.id)
  const conditionId = asText(row.condition_id)
  const discountPercent = asNumber(row.discount_percent)
  const condition = conditions.find((item) => item.id === conditionId)
  if (!assignmentId || !conditionId || discountPercent == null || !condition) return null
  return {
    assignmentId,
    conditionId,
    code: condition.code,
    name: condition.name,
    discountPercent,
    status: "active",
  }
}
