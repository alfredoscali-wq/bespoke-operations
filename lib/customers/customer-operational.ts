import type { Customer } from "@/lib/types/customers"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export type CustomerOperationalKpi = "operativos" | "activos" | "revisar"

export type CustomerQuickFilter = CustomerOperationalKpi

export const CUSTOMER_KPI_ORDER: CustomerOperationalKpi[] = [
  "operativos",
  "activos",
  "revisar",
]

export const CUSTOMER_KPI_LABELS: Record<CustomerOperationalKpi, string> = {
  operativos: "Clientes operativos",
  activos: "Activos",
  revisar: "Revisar",
}

export const CUSTOMER_KPI_TONE: Record<CustomerOperationalKpi, VisualTone> = {
  operativos: "blue",
  activos: "green",
  revisar: "yellow",
}

export const CUSTOMER_QUICK_FILTER_LABELS: Record<CustomerQuickFilter, string> = {
  operativos: "Operativos",
  activos: "Activos",
  revisar: "Revisar",
}

export type CustomerOperationalSummary = {
  operativos: number
  activos: number
  revisar: number
}

export function countCustomerOperationalSummary(
  customers: Customer[]
): CustomerOperationalSummary {
  const operational = customers.filter((customer) => !customer.deletedAt)

  return {
    operativos: operational.length,
    activos: operational.filter((customer) => customer.validationStatus === "active")
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
    return customer.validationStatus === "active"
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
