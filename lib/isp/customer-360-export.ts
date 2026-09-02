import {
  catalogTechnologyLabel,
  formatCatalogSpeed,
} from "@/lib/isp/catalog-integrity"
import { deriveIspSubscriberListStatus } from "@/lib/isp/integrity"
import {
  ISP_COMMERCIAL_STATUS_LABELS,
  ISP_MONTHLY_COLLECTION_LABELS,
} from "@/lib/isp/labels"
import { sortSubscriberServices } from "@/lib/isp/subscriber-service-integrity"
import type {
  IspCommercialStatus,
  IspMonthlyCollectionMethod,
} from "@/lib/isp/constants"

export const ISP_CUSTOMER_360_EXPORT_SHEET_NAME = "Clientes"
export const ISP_CUSTOMER_360_EXPORT_HEADERS = [
  "Número de abonado",
  "Nombre",
  "Apellido",
  "DNI / CUIT",
  "Teléfono",
  "WhatsApp",
  "Email",
  "Calle",
  "Número",
  "Piso",
  "Departamento",
  "Barrio",
  "Localidad",
  "Provincia",
  "Código Postal",
  "Servicio contratado",
  "Código del servicio",
  "Tecnología",
  "Velocidad",
  "Estado del servicio",
  "Plan TV",
  "Estado TV",
  "Importe mensual del abono",
  "Método de cobro",
  "Estado de facturación",
  "Fecha de alta",
  "Observaciones",
] as const

export type IspCustomer360ExportHeader =
  (typeof ISP_CUSTOMER_360_EXPORT_HEADERS)[number]

export type IspCustomer360ExportCatalog = {
  id: string
  companyId: string
  code: string | null
  name: string
  category: string
  technology: string | null
  downloadSpeedMbps: number | null
  uploadSpeedMbps: number | null
  speedUnit: string | null
  tvPlanCatalogId: string | null
}

export type IspCustomer360ExportTvPlan = {
  id: string
  companyId: string
  name: string
  category: string
}

export type IspCustomer360ExportService = {
  customerId: string
  catalogId: string | null
  catalogCode: string | null
  planName: string
  technology: string | null
  downloadSpeed: number | null
  uploadSpeed: number | null
  speedUnit: string | null
  monthlyFee: number | null
  commercialStatus: string
  monthlyCollectionMethod: string
  activationDate: string | null
  notes: string | null
  createdAt: string
}

export type IspCustomer360ExportCustomer = {
  id: string
  companyId: string
  name: string
  dni: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  locality: string | null
  status: string
  createdAt: string
  customerNumber: string | null
  externalCustomerCode: string | null
  statusReason: string | null
  deletedAt: string | null
}

export type IspCustomer360ExportRow = {
  subscriberNumber: string
  firstName: string
  lastName: string
  dni: string
  phone: string
  whatsapp: string
  email: string
  street: string
  streetNumber: string
  floor: string
  apartment: string
  neighborhood: string
  locality: string
  province: string
  postalCode: string
  contractedService: string
  serviceCode: string
  technology: string
  speed: string
  serviceStatus: string
  tvPlan: string
  tvStatus: string
  monthlyFee: number | null
  collectionMethod: string
  billingStatus: string
  activationDate: string
  notes: string
}

export function ispCustomer360ExportFileName(date = new Date()): string {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return `Clientes360_ABNet_${stamp}.xlsx`
}

export function splitIspCustomerName(name: string | null | undefined): {
  firstName: string
  lastName: string
} {
  const trimmed = name?.trim() ?? ""
  if (!trimmed) return { firstName: "", lastName: "" }
  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",")
    return {
      lastName: last.trim(),
      firstName: rest.join(",").trim(),
    }
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export function splitIspCustomerAddress(address: string | null | undefined): {
  street: string
  streetNumber: string
} {
  const trimmed = address?.trim() ?? ""
  if (!trimmed) return { street: "", streetNumber: "" }
  const match = trimmed.match(/^(.*?)[,\s]+(\d+[A-Za-z]?)$/)
  if (!match) return { street: trimmed, streetNumber: "" }
  const street = match[1]?.trim() ?? ""
  const streetNumber = match[2]?.trim() ?? ""
  if (!street) return { street: trimmed, streetNumber: "" }
  return { street, streetNumber }
}

export function isActiveIspCustomer360Export(input: {
  companyId: string
  customer: Pick<
    IspCustomer360ExportCustomer,
    "companyId" | "status" | "deletedAt"
  >
  subscriberDeletedAt: string | null | undefined
  commercialStatuses: Array<string | null | undefined>
}): boolean {
  if (input.customer.companyId !== input.companyId) return false
  if (input.customer.deletedAt) return false
  if (input.subscriberDeletedAt) return false
  return (
    deriveIspSubscriberListStatus({
      customerStatus: input.customer.status,
      commercialStatuses: input.commercialStatuses,
    }) === "activo"
  )
}

export function pickPrimaryIspExportService(
  services: IspCustomer360ExportService[],
  catalogById: Map<string, IspCustomer360ExportCatalog>
): IspCustomer360ExportService | null {
  if (services.length === 0) return null
  const sorted = sortSubscriberServices(services)
  const commercial = sorted.find((service) => {
    const category = service.catalogId
      ? catalogById.get(service.catalogId)?.category
      : null
    return category !== "tv"
  })
  return commercial ?? sorted[0] ?? null
}

export function resolveIspExportTvPlanName(input: {
  catalog: IspCustomer360ExportCatalog | null | undefined
  tvPlanById: Map<string, IspCustomer360ExportTvPlan>
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

function commercialStatusLabel(status: string): string {
  if (status in ISP_COMMERCIAL_STATUS_LABELS) {
    return ISP_COMMERCIAL_STATUS_LABELS[status as IspCommercialStatus]
  }
  return status
}

function collectionMethodLabel(method: string): string {
  if (method in ISP_MONTHLY_COLLECTION_LABELS) {
    return ISP_MONTHLY_COLLECTION_LABELS[method as IspMonthlyCollectionMethod]
  }
  return method
}

function formatExportDate(value: string | null | undefined): string {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  return value
}

export function mapIspCustomer360ExportRow(input: {
  companyId: string
  customer: IspCustomer360ExportCustomer
  services: IspCustomer360ExportService[]
  catalogById: Map<string, IspCustomer360ExportCatalog>
  tvPlanById: Map<string, IspCustomer360ExportTvPlan>
}): IspCustomer360ExportRow {
  const { firstName, lastName } = splitIspCustomerName(input.customer.name)
  const { street, streetNumber } = splitIspCustomerAddress(
    input.customer.address
  )
  const service = pickPrimaryIspExportService(
    input.services,
    input.catalogById
  )
  const catalog = service?.catalogId
    ? input.catalogById.get(service.catalogId)
    : undefined
  const tvPlan = resolveIspExportTvPlanName({
    catalog,
    tvPlanById: input.tvPlanById,
    companyId: input.companyId,
  })
  const serviceStatus = service
    ? commercialStatusLabel(service.commercialStatus)
    : ""
  const download = service?.downloadSpeed ?? catalog?.downloadSpeedMbps ?? null
  const upload = service?.uploadSpeed ?? catalog?.uploadSpeedMbps ?? null
  const unit = service?.speedUnit ?? catalog?.speedUnit ?? "mbps"
  const technology = catalogTechnologyLabel(
    catalog?.technology ?? service?.technology
  )

  return {
    subscriberNumber: (
      input.customer.externalCustomerCode ??
      input.customer.customerNumber ??
      ""
    ).trim(),
    firstName,
    lastName,
    dni: input.customer.dni?.trim() ?? "",
    phone: input.customer.phone?.trim() ?? "",
    whatsapp: input.customer.whatsapp?.trim() ?? "",
    email: input.customer.email?.trim() ?? "",
    street,
    streetNumber,
    floor: "",
    apartment: "",
    neighborhood: "",
    locality: input.customer.locality?.trim() ?? "",
    province: "",
    postalCode: "",
    contractedService: (catalog?.name ?? service?.planName ?? "").trim(),
    serviceCode: (catalog?.code ?? service?.catalogCode ?? "").trim(),
    technology: service || catalog ? technology : "",
    speed: service || catalog ? formatCatalogSpeed(download, upload, unit) : "",
    serviceStatus,
    tvPlan,
    tvStatus: tvPlan ? serviceStatus : "",
    monthlyFee: service?.monthlyFee ?? null,
    collectionMethod: service
      ? collectionMethodLabel(service.monthlyCollectionMethod)
      : "",
    billingStatus: serviceStatus,
    activationDate: formatExportDate(
      service?.activationDate ?? input.customer.createdAt
    ),
    notes: (service?.notes ?? input.customer.statusReason ?? "").trim(),
  }
}

export function compareIspCustomer360ExportRows(
  left: Pick<IspCustomer360ExportRow, "subscriberNumber" | "firstName" | "lastName">,
  right: Pick<IspCustomer360ExportRow, "subscriberNumber" | "firstName" | "lastName">
): number {
  const leftCode = left.subscriberNumber.trim()
  const rightCode = right.subscriberNumber.trim()
  const leftName = `${left.firstName} ${left.lastName}`.trim()
  const rightName = `${right.firstName} ${right.lastName}`.trim()

  if (leftCode && rightCode) {
    const byCode = leftCode.localeCompare(rightCode, "es", { numeric: true })
    if (byCode !== 0) return byCode
    return leftName.localeCompare(rightName, "es")
  }
  if (leftCode && !rightCode) return -1
  if (!leftCode && rightCode) return 1
  return leftName.localeCompare(rightName, "es")
}

export function buildIspCustomer360ExportRows(input: {
  companyId: string
  customers: IspCustomer360ExportCustomer[]
  subscriberDeletedAtByCustomerId: Map<string, string | null>
  servicesByCustomerId: Map<string, IspCustomer360ExportService[]>
  catalogById: Map<string, IspCustomer360ExportCatalog>
  tvPlanById: Map<string, IspCustomer360ExportTvPlan>
}): IspCustomer360ExportRow[] {
  const rows: IspCustomer360ExportRow[] = []
  for (const customer of input.customers) {
    const services = input.servicesByCustomerId.get(customer.id) ?? []
    if (
      !isActiveIspCustomer360Export({
        companyId: input.companyId,
        customer,
        subscriberDeletedAt:
          input.subscriberDeletedAtByCustomerId.get(customer.id) ?? null,
        commercialStatuses: services.map((service) => service.commercialStatus),
      })
    ) {
      continue
    }
    rows.push(
      mapIspCustomer360ExportRow({
        companyId: input.companyId,
        customer,
        services,
        catalogById: input.catalogById,
        tvPlanById: input.tvPlanById,
      })
    )
  }
  return rows.sort(compareIspCustomer360ExportRows)
}

export function ispCustomer360ExportRowValues(
  row: IspCustomer360ExportRow
): Array<string | number | null> {
  return [
    row.subscriberNumber,
    row.firstName,
    row.lastName,
    row.dni,
    row.phone,
    row.whatsapp,
    row.email,
    row.street,
    row.streetNumber,
    row.floor,
    row.apartment,
    row.neighborhood,
    row.locality,
    row.province,
    row.postalCode,
    row.contractedService,
    row.serviceCode,
    row.technology,
    row.speed,
    row.serviceStatus,
    row.tvPlan,
    row.tvStatus,
    row.monthlyFee,
    row.collectionMethod,
    row.billingStatus,
    row.activationDate,
    row.notes,
  ]
}
