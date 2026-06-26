import {
  matchCustomerSearchQuery,
  matchesCustomerQuickFilter,
  type CustomerQuickFilter,
} from "@/lib/customers/customer-operational"
import type { Customer } from "@/lib/types/customers"

export type CustomerFilters = {
  search: string
  quickFilter: CustomerQuickFilter
}

export const defaultCustomerFilters: CustomerFilters = {
  search: "",
  quickFilter: "operativos",
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

    return matchesCustomerQuickFilter(customer, filters.quickFilter)
  })
}
