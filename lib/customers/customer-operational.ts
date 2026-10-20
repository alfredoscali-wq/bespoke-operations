import {
  isCustomerStatusActive,
  isCustomerStatusPendingActivation,
} from "@/lib/customers/format"
import type { Customer } from "@/lib/types/customers"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export type CustomerOperationalKpi =
  | "operativos"
  | "activos"
  | "pendientes-activacion"
  | "revisar"

export type CustomerQuickFilter = CustomerOperationalKpi

export const CUSTOMER_KPI_ORDER: CustomerOperationalKpi[] = [
  "operativos",
  "activos",
  "pendientes-activacion",
  "revisar",
]

export const CUSTOMER_KPI_LABELS: Record<CustomerOperationalKpi, string> = {
  operativos: "Clientes operativos",
  activos: "Activos",
  "pendientes-activacion": "Pendientes de activación",
  revisar: "Revisar",
}

export const CUSTOMER_KPI_TONE: Record<CustomerOperationalKpi, VisualTone> = {
  operativos: "blue",
  activos: "green",
  "pendientes-activacion": "yellow",
  revisar: "yellow",
}

export const CUSTOMER_QUICK_FILTER_LABELS: Record<CustomerQuickFilter, string> = {
  operativos: "Operativos",
  activos: "Activos",
  "pendientes-activacion": "Pendientes de activación",
  revisar: "Revisar",
}

export type CustomerOperationalSummary = {
  operativos: number
  activos: number
  "pendientes-activacion": number
  revisar: number
}

function hasCustomerListNumber(
  externalCustomerCode: string | null | undefined
): boolean {
  return Boolean(externalCustomerCode?.trim())
}

export const CUSTOMER_ALREADY_ACTIVE_MESSAGE = "Este cliente ya está activo."
export const CUSTOMER_NOT_PENDING_ACTIVATION_MESSAGE =
  "Este cliente no está pendiente de activación."

export function isPendingActivationListCustomer(
  customer: Pick<Customer, "status" | "externalCustomerCode">
): boolean {
  return (
    isCustomerStatusPendingActivation(customer.status) &&
    !hasCustomerListNumber(customer.externalCustomerCode)
  )
}

export function planClients360CustomerActivation(
  customer: Pick<Customer, "status" | "externalCustomerCode">
):
  | { outcome: "activate"; previousStatus: string }
  | { outcome: "rejected"; message: string } {
  if (isCustomerStatusActive(customer.status)) {
    return { outcome: "rejected", message: CUSTOMER_ALREADY_ACTIVE_MESSAGE }
  }
  if (!isPendingActivationListCustomer(customer)) {
    return { outcome: "rejected", message: CUSTOMER_NOT_PENDING_ACTIVATION_MESSAGE }
  }
  return { outcome: "activate", previousStatus: customer.status }
}

export function isCommerciallyActiveCustomer(customer: Customer): boolean {
  return (
    customer.validationStatus === "active" &&
    !isCustomerStatusPendingActivation(customer.status)
  )
}

export function countCustomerOperationalSummary(
  customers: Customer[]
): CustomerOperationalSummary {
  const operational = customers.filter((customer) => !customer.deletedAt)

  return {
    operativos: operational.length,
    activos: operational.filter(isCommerciallyActiveCustomer).length,
    "pendientes-activacion": operational.filter(isPendingActivationListCustomer)
      .length,
    revisar: operational.filter((customer) => customer.validationStatus === "review")
      .length,
  }
}

export function getOperationalKpiValue(
  summary: CustomerOperationalSummary,
  kpi: CustomerOperationalKpi
): number {
  return summary[kpi]
}

export function matchesCustomerQuickFilter(
  customer: Customer,
  filter: CustomerQuickFilter
): boolean {
  if (filter === "operativos") {
    return true
  }

  if (filter === "activos") {
    return isCommerciallyActiveCustomer(customer)
  }

  if (filter === "pendientes-activacion") {
    return isPendingActivationListCustomer(customer)
  }

  return customer.validationStatus === "review"
}

export function matchCustomerSearchQuery(
  customer: Customer,
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const fields = [
    customer.name,
    customer.externalCustomerCode,
    customer.dni,
    customer.phone,
    customer.address,
    customer.locality,
    customer.legacyMigrationId ? String(customer.legacyMigrationId) : "",
  ]

  return fields.some((field) =>
    field?.toLowerCase().includes(normalizedQuery)
  )
}
