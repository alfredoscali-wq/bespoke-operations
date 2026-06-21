import { isCustomerActive } from "@/lib/customers/customer-category"
import type { Customer } from "@/lib/types/customers"

export type CustomerStatusFilter = "all" | "activo" | "inactivo"
export type CustomerTechnologyFilter = "all" | "fiber" | "wireless"

export type CustomerFilters = {
  search: string
  status: CustomerStatusFilter
  technology: CustomerTechnologyFilter
}

export const defaultCustomerFilters: CustomerFilters = {
  search: "",
  status: "all",
  technology: "all",
}

export function filterCustomers(
  customers: Customer[],
  filters: CustomerFilters
): Customer[] {
  return customers.filter((customer) => {
    if (filters.status === "activo" && !isCustomerActive(customer)) {
      return false
    }

    if (filters.status === "inactivo" && isCustomerActive(customer)) {
      return false
    }

    if (
      filters.technology !== "all" &&
      customer.technology !== filters.technology
    ) {
      return false
    }

    return true
  })
}
