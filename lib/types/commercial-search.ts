/**
 * Commercial unified search types.
 * Designed to grow into Bespoke Operations global search — add categories
 * without changing the UX contract (grouped results + selectable items).
 */

export type CommercialSearchCategoryKey =
  | "clients"
  | "activities"
  // Future: "projects" | "work_orders" | "employees" | ...
  | (string & {})

export type CommercialSearchBadge = {
  label: string
  color?: string | null
}

export type CommercialSearchResultItem = {
  id: string
  category: CommercialSearchCategoryKey
  title: string
  subtitle?: string | null
  badge?: CommercialSearchBadge | null
  /** Relative or absolute time hint for activities. */
  meta?: string | null
  /** Opaque payload for navigation (kept out of the generic UI). */
  payload?: Record<string, unknown>
}

export type CommercialSearchGroup = {
  key: CommercialSearchCategoryKey
  label: string
  items: CommercialSearchResultItem[]
}

export type CommercialSearchResponse = {
  query: string
  groups: CommercialSearchGroup[]
  /** Convenience mirrors for early consumers; prefer `groups`. */
  clients: CommercialSearchResultItem[]
  activities: CommercialSearchResultItem[]
}

export const COMMERCIAL_SEARCH_LIMIT_PER_GROUP = 10
export const COMMERCIAL_SEARCH_MIN_CHARS = 2
