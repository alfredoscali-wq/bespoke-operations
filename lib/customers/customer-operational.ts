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

function isCommerciallyActiveCustomer(customer: Customer): boolean {
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
    "pendientes-activacion": operational.filter((customer) =>
      isCustomerStatusPendingActivation(customer.status)
    ).length,
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
    return isCustomerStatusPendingActivation(customer.status)
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
