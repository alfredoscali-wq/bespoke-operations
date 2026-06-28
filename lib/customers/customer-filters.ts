import {
  matchCustomerSearchQuery,
  matchesCustomerQuickFilter,
  type CustomerQuickFilter,
} from "@/lib/customers/customer-operational"
import {
  CUSTOMER_STATUS_PENDING_ACTIVATION,
  isCustomerStatusPendingActivation,
} from "@/lib/customers/format"
import type { Customer } from "@/lib/types/customers"

export type CustomerStatusFilter =
  | "all"
  | "activo"
  | "pendiente-activacion"
  | "inactivo"

export type CustomerListSort =
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"

export type CustomerFilters = {
  search: string
  quickFilter: CustomerQuickFilter
  locality?: string
  statusFilter: CustomerStatusFilter
  sort: CustomerListSort
}

export const defaultCustomerFilters: CustomerFilters = {
  search: "",
  quickFilter: "operativos",
  statusFilter: "all",
  sort: "name-asc",
}

export const CUSTOMER_STATUS_FILTER_OPTIONS: {
  value: CustomerStatusFilter
  label: string
}[] = [
  { value: "all", label: "Todos" },
  { value: "activo", label: "Activos" },
  {
    value: "pendiente-activacion",
    label: "Pendientes de activación",
  },
  { value: "inactivo", label: "Inactivos" },
]

export const CUSTOMER_SORT_OPTIONS: {
  value: CustomerListSort
  label: string
}[] = [
  { value: "name-asc", label: "Nombre (A → Z)" },
  { value: "name-desc", label: "Nombre (Z → A)" },
  { value: "created-desc", label: "Más recientes" },
  { value: "created-asc", label: "Más antiguos" },
]

export function hasCustomerListFilters(filters: CustomerFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    Boolean(filters.locality) ||
    filters.statusFilter !== "all" ||
    filters.quickFilter !== "operativos"
  )
}

export function formatCustomerResultCount(
  count: number,
  hasFilters: boolean
): string {
  const formatted = count.toLocaleString("es-AR")

  if (hasFilters) {
    return `${formatted} ${count === 1 ? "cliente encontrado" : "clientes encontrados"}`
  }

  return `${formatted} ${count === 1 ? "cliente" : "clientes"}`
}

function matchesCustomerStatusFilter(
  customer: Customer,
  statusFilter: CustomerStatusFilter
): boolean {
  if (statusFilter === "all") {
    return true
  }

  if (statusFilter === "activo") {
    return customer.status.trim().toLowerCase() === "activo"
  }

  if (statusFilter === "inactivo") {
    return customer.status.trim().toLowerCase() === "inactivo"
  }

  return isCustomerStatusPendingActivation(customer.status)
}

function matchesCustomerLocalityFilter(
  customer: Customer,
  locality?: string
): boolean {
  if (!locality) {
    return true
  }

  return customer.locality?.trim() === locality
}

export function filterCustomers(
  customers: Customer[],
  filters: CustomerFilters
): Customer[] {
  return customers.filter((customer) => {
    if (customer.deletedAt) {
      return false
    }

    if (!matchCustomerSearchQuery(customer, filters.search)) {
      return false
    }

    if (!matchesCustomerQuickFilter(customer, filters.quickFilter)) {
      return false
    }

    if (!matchesCustomerStatusFilter(customer, filters.statusFilter)) {
      return false
    }

    if (!matchesCustomerLocalityFilter(customer, filters.locality)) {
      return false
    }

    return true
  })
}

export function resolveCustomerStatusFilterValue(
  statusFilter: CustomerStatusFilter
): string | undefined {
  if (statusFilter === "all") {
    return undefined
  }

  if (statusFilter === "pendiente-activacion") {
    return CUSTOMER_STATUS_PENDING_ACTIVATION
  }

  return statusFilter
}
