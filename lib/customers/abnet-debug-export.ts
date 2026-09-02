import {
  isCommerciallyActiveCustomer,
} from "@/lib/customers/customer-operational"
import { isCustomerStatusActive } from "@/lib/customers/format"
import type { Customer } from "@/lib/types/customers"

export const ABNET_DEBUG_EXPORT_SHEET_NAME = "Clientes"
export const ABNET_DEBUG_EXPORT_HEADERS = [
  "id",
  "numero_abonado",
  "identificador_externo",
  "legacy_migration_id",
  "nombre",
  "apellido",
  "nombre_completo",
  "dni",
  "telefono",
  "whatsapp",
  "email",
  "domicilio",
  "localidad",
  "provincia",
  "estado",
  "validation_status",
  "tecnologia",
  "servicio_contratado",
  "codigo_servicio",
  "nombre_comercial_servicio",
  "plan_tv",
] as const

export type AbnetDebugExportRow = {
  id: string
  subscriberNumber: string
  externalCode: string
  legacyMigrationId: string
  firstName: string
  lastName: string
  fullName: string
  dni: string
  phone: string
  whatsapp: string
  email: string
  address: string
  locality: string
  province: string
  status: string
  validationStatus: string
  technology: string
  contractedService: string
  serviceCode: string
  commercialServiceName: string
  planTv: string
}

export type AbnetDebugCatalog = {
  id: string
  companyId: string
  code: string | null
  name: string
  category: string
  tvPlanCatalogId: string | null
}

export type AbnetDebugTvPlan = {
  id: string
  companyId: string
  name: string
  category: string
}

export type AbnetDebugService = {
  customerId: string
  catalogId: string | null
  catalogCode: string | null
  planName: string
  commercialStatus: string
  createdAt: string
  activationDate: string | null
}

export function abnetDebugExportFileName(date = new Date()): string {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return `Clientes_ABNet_${stamp}.xlsx`
}

export function splitAbnetCustomerName(name: string | null | undefined): {
  firstName: string
  lastName: string
} {
  const trimmed = name?.trim() ?? ""
  if (!trimmed) return { firstName: "", lastName: "" }
  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",")
    return { lastName: last.trim(), firstName: rest.join(",").trim() }
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export function isAbnetDebugExportActiveCustomer(customer: Customer): boolean {
  if (customer.deletedAt) return false
  if (!isCommerciallyActiveCustomer(customer)) return false
  return isCustomerStatusActive(customer.status)
}

export function resolveAbnetDebugPlanTv(input: {
  catalog: AbnetDebugCatalog | null | undefined
  tvPlanById: Map<string, AbnetDebugTvPlan>
  companyId: string
}): string {
  const tvPlanId = input.catalog?.tvPlanCatalogId?.trim() ?? ""
  if (!tvPlanId) return ""
  const plan = input.tvPlanById.get(tvPlanId)
  if (!plan) return ""
  if (plan.companyId !== input.companyId) return ""
  if (plan.category !== "tv") return ""
  return plan.name.trim()
}

export function pickAbnetDebugCommercialService(
  services: AbnetDebugService[],
  catalogById: Map<string, AbnetDebugCatalog>
): AbnetDebugService | null {
  if (services.length === 0) return null
  const sorted = [...services].sort((left, right) => {
    const leftCancelled = left.commercialStatus === "cancelled" ? 1 : 0
    const rightCancelled = right.commercialStatus === "cancelled" ? 1 : 0
    if (leftCancelled !== rightCancelled) return leftCancelled - rightCancelled
    const leftDate = left.activationDate ?? left.createdAt
    const rightDate = right.activationDate ?? right.createdAt
    return rightDate.localeCompare(leftDate)
  })
  return (
    sorted.find((service) => {
      const category = service.catalogId
        ? catalogById.get(service.catalogId)?.category
        : null
      return category !== "tv"
    }) ??
    sorted[0] ??
    null
  )
}

export function mapAbnetDebugExportRow(input: {
  companyId: string
  customer: Customer
  services: AbnetDebugService[]
  catalogById: Map<string, AbnetDebugCatalog>
  tvPlanById: Map<string, AbnetDebugTvPlan>
}): AbnetDebugExportRow {
  const { firstName, lastName } = splitAbnetCustomerName(input.customer.name)
  const service = pickAbnetDebugCommercialService(
    input.services,
    input.catalogById
  )
  const catalog = service?.catalogId
    ? input.catalogById.get(service.catalogId)
    : undefined
  const commercialName = (catalog?.name ?? service?.planName ?? "").trim()
  const contracted = commercialName || (input.customer.contractedPlan ?? "").trim()
  const planTv = resolveAbnetDebugPlanTv({
    catalog,
    tvPlanById: input.tvPlanById,
    companyId: input.companyId,
  })

  return {
    id: input.customer.id,
    subscriberNumber: input.customer.customerNumber?.trim() ?? "",
    externalCode: input.customer.externalCustomerCode?.trim() ?? "",
    legacyMigrationId:
      input.customer.legacyMigrationId != null
        ? String(input.customer.legacyMigrationId)
        : "",
    firstName,
    lastName,
    fullName: input.customer.name.trim(),
    dni: input.customer.dni?.trim() ?? "",
    phone: input.customer.phone?.trim() ?? "",
    whatsapp: input.customer.whatsapp?.trim() ?? "",
    email: input.customer.email?.trim() ?? "",
    address: input.customer.address?.trim() ?? "",
    locality: input.customer.locality?.trim() ?? "",
    province: "",
    status: input.customer.status,
    validationStatus: input.customer.validationStatus,
    technology: input.customer.technology?.trim() ?? "",
    contractedService: contracted,
    serviceCode: (catalog?.code ?? service?.catalogCode ?? "").trim(),
    commercialServiceName: commercialName,
    planTv,
  }
}

export function buildAbnetDebugExportRows(input: {
  companyId: string
  customers: Customer[]
  servicesByCustomerId: Map<string, AbnetDebugService[]>
  catalogById: Map<string, AbnetDebugCatalog>
  tvPlanById: Map<string, AbnetDebugTvPlan>
}): AbnetDebugExportRow[] {
  return input.customers
    .filter(isAbnetDebugExportActiveCustomer)
    .map((customer) =>
      mapAbnetDebugExportRow({
        companyId: input.companyId,
        customer,
        services: input.servicesByCustomerId.get(customer.id) ?? [],
        catalogById: input.catalogById,
        tvPlanById: input.tvPlanById,
      })
    )
    .sort((left, right) => {
      const byCode = left.externalCode.localeCompare(right.externalCode, "es", {
        numeric: true,
      })
      if (left.externalCode && right.externalCode && byCode !== 0) return byCode
      if (left.externalCode && !right.externalCode) return -1
      if (!left.externalCode && right.externalCode) return 1
      return left.fullName.localeCompare(right.fullName, "es")
    })
}

export function abnetDebugExportRowValues(
  row: AbnetDebugExportRow
): Array<string | number> {
  return [
    row.id,
    row.subscriberNumber,
    row.externalCode,
    row.legacyMigrationId,
    row.firstName,
    row.lastName,
    row.fullName,
    row.dni,
    row.phone,
    row.whatsapp,
    row.email,
    row.address,
    row.locality,
    row.province,
    row.status,
    row.validationStatus,
    row.technology,
    row.contractedService,
    row.serviceCode,
    row.commercialServiceName,
    row.planTv,
  ]
}
