import {
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
  type ActivityModule,
  type ActivityOrigin,
} from "@/lib/activity/types"
import {
  ACTIVITY_VIEWER_PAGE_SIZE,
  type ActivityViewerQuery,
} from "@/lib/activity/activity-viewer-types"
import {
  FIXED_COMPANY_AREA_CODES,
  type FixedCompanyAreaCode,
} from "@/lib/roles/company-areas"

export type ActivityViewerUrlState = {
  from?: string
  to?: string
  userSearch?: string
  employeeId?: string
  area?: FixedCompanyAreaCode
  module?: ActivityModule
  action?: string
  origin?: ActivityOrigin
  offset?: number
  limit?: number
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseModule(value: string | null): ActivityModule | undefined {
  if (!value) return undefined
  return (Object.values(ACTIVITY_MODULES) as string[]).includes(value)
    ? (value as ActivityModule)
    : undefined
}

function parseOrigin(value: string | null): ActivityOrigin | undefined {
  if (!value) return undefined
  return (Object.values(ACTIVITY_ORIGINS) as string[]).includes(value)
    ? (value as ActivityOrigin)
    : undefined
}

function parseArea(value: string | null): FixedCompanyAreaCode | undefined {
  if (!value) return undefined
  return (FIXED_COMPANY_AREA_CODES as readonly string[]).includes(value)
    ? (value as FixedCompanyAreaCode)
    : undefined
}

export function parseActivityViewerSearchParams(
  searchParams: URLSearchParams
): ActivityViewerUrlState {
  return {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    userSearch: searchParams.get("user") ?? undefined,
    employeeId: searchParams.get("employeeId") ?? undefined,
    area: parseArea(searchParams.get("area")),
    module: parseModule(searchParams.get("module")),
    action: searchParams.get("action") ?? undefined,
    origin: parseOrigin(searchParams.get("origin")),
    offset: parsePositiveInt(searchParams.get("offset"), 0),
    limit: parsePositiveInt(searchParams.get("limit"), ACTIVITY_VIEWER_PAGE_SIZE),
  }
}

export function buildActivityViewerSearchParams(
  state: ActivityViewerUrlState
): URLSearchParams {
  const params = new URLSearchParams()

  if (state.from) params.set("from", state.from)
  if (state.to) params.set("to", state.to)
  if (state.userSearch) params.set("user", state.userSearch)
  if (state.employeeId) params.set("employeeId", state.employeeId)
  if (state.area) params.set("area", state.area)
  if (state.module) params.set("module", state.module)
  if (state.action) params.set("action", state.action)
  if (state.origin) params.set("origin", state.origin)
  if (state.offset && state.offset > 0) {
    params.set("offset", String(state.offset))
  }
  if (state.limit && state.limit !== ACTIVITY_VIEWER_PAGE_SIZE) {
    params.set("limit", String(state.limit))
  }

  return params
}

export function buildActivityEventsQueryParams(
  state: ActivityViewerUrlState
): URLSearchParams {
  return buildActivityViewerSearchParams(state)
}

export function toActivityViewerServerQuery(
  companyId: string,
  state: ActivityViewerUrlState
): ActivityViewerQuery {
  return {
    companyId,
    from: state.from,
    to: state.to,
    employeeId: state.employeeId,
    userSearch: state.userSearch,
    area: state.area,
    module: state.module,
    action: state.action,
    origin: state.origin,
    offset: state.offset ?? 0,
    limit: state.limit ?? ACTIVITY_VIEWER_PAGE_SIZE,
  }
}
