import type {
  CustomerListSort,
  CustomerStatusFilter,
} from "@/lib/customers/customer-filters"
import type { CustomerQuickFilter } from "@/lib/customers/customer-operational"

export const DEFAULT_CUSTOMER_PAGE_SIZE = 50

export type CustomerListQuery = {
  page: number
  pageSize?: number
  search?: string
  quickFilter: CustomerQuickFilter
  locality?: string
  statusFilter?: CustomerStatusFilter
  sort?: CustomerListSort
}

export function buildCustomerListQueryKey(query: CustomerListQuery): string {
  return JSON.stringify({
    page: query.page,
    pageSize: query.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE,
    search: query.search?.trim() ?? "",
    quickFilter: query.quickFilter,
    locality: query.locality ?? "",
    statusFilter: query.statusFilter ?? "all",
    sort: query.sort ?? "name-asc",
  })
}

export function escapeCustomerSearchPattern(query: string): string {
  return `%${query.replace(/[%_,]/g, "")}%`
}
