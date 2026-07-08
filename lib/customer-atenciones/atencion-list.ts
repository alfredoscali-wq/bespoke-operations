export const DEFAULT_ATENCION_PAGE_SIZE = 25

export type CustomerAtencionListQuery = {
  page: number
  pageSize?: number
  search?: string
}

export function escapeAtencionSearchPattern(query: string): string {
  return `%${query.replace(/[%_,]/g, "")}%`
}
