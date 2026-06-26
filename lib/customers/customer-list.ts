import type { CustomerQuickFilter } from "@/lib/customers/customer-operational"

export const DEFAULT_CUSTOMER_PAGE_SIZE = 50

export type CustomerListQuery = {
  page: number
  pageSize?: number
  search?: string
  quickFilter: CustomerQuickFilter
}

export function buildCustomerListQueryKey(query: CustomerListQuery): string {
  return JSON.stringify({
    page: query.page,
    pageSize: query.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE,
    search: query.search?.trim() ?? "",
    quickFilter: query.quickFilter,
  })
}

export function escapeCustomerSearchPattern(query: string): string {
  return `%${query.replace(/[%_,]/g, "")}%`
}
