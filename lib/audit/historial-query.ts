import type { AuditLogQuery, AuditModule, AuditSeverity } from "@/lib/audit/types"
import { AUDIT_MODULES } from "@/lib/audit/types"

export type HistorialUrlState = AuditLogQuery & {
  kpi?: string
}

function parseModule(value: string | null): AuditModule | undefined {
  if (!value) return undefined
  return Object.values(AUDIT_MODULES).includes(value as AuditModule)
    ? (value as AuditModule)
    : undefined
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseSeverity(value: string | null): AuditSeverity | undefined {
  if (value === "INFO" || value === "WARNING" || value === "CRITICAL") {
    return value
  }
  return undefined
}

export function parseHistorialSearchParams(
  searchParams: URLSearchParams
): HistorialUrlState {
  return {
    module: parseModule(searchParams.get("module")),
    action: searchParams.get("action") ?? undefined,
    entityType: searchParams.get("entityType") ?? undefined,
    severity: parseSeverity(searchParams.get("severity")),
    performedByUserId: searchParams.get("user") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    entityLabel: searchParams.get("entity") ?? undefined,
    otCode: searchParams.get("ot") ?? undefined,
    customerQuery: searchParams.get("cliente") ?? undefined,
    projectQuery: searchParams.get("obra") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    page: parsePositiveInt(searchParams.get("page"), 1),
    limit: parsePositiveInt(searchParams.get("limit"), 50),
    kpi: searchParams.get("kpi") ?? undefined,
  }
}

export function buildHistorialSearchParams(
  state: HistorialUrlState
): URLSearchParams {
  const params = new URLSearchParams()

  if (state.module) params.set("module", state.module)
  if (state.action) params.set("action", state.action)
  if (state.entityType) params.set("entityType", state.entityType)
  if (state.severity) params.set("severity", state.severity)
  if (state.performedByUserId) params.set("user", state.performedByUserId)
  if (state.search) params.set("search", state.search)
  if (state.entityLabel) params.set("entity", state.entityLabel)
  if (state.otCode) params.set("ot", state.otCode)
  if (state.customerQuery) params.set("cliente", state.customerQuery)
  if (state.projectQuery) params.set("obra", state.projectQuery)
  if (state.from) params.set("from", state.from)
  if (state.to) params.set("to", state.to)
  if (state.kpi) params.set("kpi", state.kpi)
  if (state.page && state.page > 1) params.set("page", String(state.page))
  if (state.limit && state.limit !== 50) params.set("limit", String(state.limit))

  return params
}

export function applyHistorialKpiFilter(
  kpi: string | undefined,
  base: HistorialUrlState
): HistorialUrlState {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = today.toISOString()
  const end = new Date(today)
  end.setHours(23, 59, 59, 999)
  const to = end.toISOString()

  switch (kpi) {
    case "events-today":
      return { ...base, from, to, kpi, page: 1 }
    case "active-users":
      return { ...base, from, to, kpi, page: 1 }
    case "tasks-created":
      return {
        ...base,
        from,
        to,
        action: "TASK_CREATE",
        module: AUDIT_MODULES.TAREAS,
        kpi,
        page: 1,
      }
    case "tasks-finished":
      return {
        ...base,
        from,
        to,
        action: "TASK_FINISH",
        module: AUDIT_MODULES.TAREAS,
        kpi,
        page: 1,
      }
    case "errors":
      return {
        ...base,
        from,
        to,
        severity: "CRITICAL",
        kpi,
        page: 1,
      }
    case "logins":
      return {
        ...base,
        from,
        to,
        action: "USER_LOGIN",
        module: AUDIT_MODULES.USUARIOS,
        kpi,
        page: 1,
      }
    default:
      return { ...base, kpi: undefined }
  }
}

export function buildAuditEventsQueryParams(
  state: HistorialUrlState
): URLSearchParams {
  const params = new URLSearchParams()

  if (state.module) params.set("module", state.module)
  if (state.action) params.set("action", state.action)
  if (state.entityType) params.set("entityType", state.entityType)
  if (state.entityId) params.set("entityId", state.entityId)
  if (state.severity) params.set("severity", state.severity)
  if (state.performedByUserId)
    params.set("performedByUserId", state.performedByUserId)
  if (state.search) params.set("search", state.search)
  if (state.entityLabel) params.set("entityLabel", state.entityLabel)
  if (state.otCode) params.set("otCode", state.otCode)
  if (state.customerQuery) params.set("customerQuery", state.customerQuery)
  if (state.projectQuery) params.set("projectQuery", state.projectQuery)
  if (state.from) params.set("from", state.from)
  if (state.to) params.set("to", state.to)
  if (state.page) params.set("page", String(state.page))
  if (state.limit) params.set("limit", String(state.limit))

  return params
}
