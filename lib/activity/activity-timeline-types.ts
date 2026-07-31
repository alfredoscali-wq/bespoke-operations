/**
 * Shared Timeline types (client + API).
 * Mirrors Query Service output — no name resolution.
 */

export const ACTIVITY_TIMELINE_PAGE_SIZE = 50

export type ActivityTimelineEvent = {
  id: string
  companyId: string
  employeeId: string | null
  appUserId: string | null
  module: string
  entityType: string
  entityId: string | null
  action: string
  title: string
  description: string | null
  metadata: Record<string, unknown>
  createdAt: string
  deletedAt: string | null
}

export type ActivityTimelineStats = {
  total: number
  firstEventAt: string | null
  lastEventAt: string | null
}

export type ActivityTimelineQueryResult = {
  items: ActivityTimelineEvent[]
  total: number
  hasMore: boolean
  limit: number
  offset: number
  stats: ActivityTimelineStats
}

export type ActivityTimelineScope =
  | { kind: "global" }
  | { kind: "employee"; employeeId: string }
  | {
      kind: "entity"
      entityType: string
      entityId: string
      /** Optional module hint for Query Service wrappers (e.g. work orders). */
      module?: string
    }

export type ActivityTimelineFilterKey =
  | "company"
  | "employee"
  | "module"
  | "entityType"
  | "action"
  | "dateFrom"
  | "dateTo"
  | "search"

export type ActivityTimelineVisibleFilters = Partial<
  Record<ActivityTimelineFilterKey, boolean>
>

export type ActivityTimelineFilters = {
  employeeId?: string
  module?: string
  entityType?: string
  entityId?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  limit?: number
  offset?: number
  order?: "ASC" | "DESC"
  /** Server routing hint — mirrors ActivityTimelineScope.kind */
  scope?: "global" | "employee" | "entity"
}

export const ACTIVITY_TIMELINE_MODULE_OPTIONS = [
  { value: "rrhh", label: "RRHH" },
  { value: "customers", label: "Clientes" },
  { value: "requests", label: "Solicitudes" },
  { value: "commercial", label: "Comercial" },
  /** Includes legacy `customer_service` via Query Service module alias expansion. */
  { value: "atencion", label: "Atención" },
  { value: "projects", label: "Obras" },
  { value: "tasks", label: "Órdenes de trabajo" },
  { value: "planning", label: "Planificación" },
  { value: "crews", label: "Cuadrillas" },
  { value: "settings", label: "Configuración" },
] as const

export const ACTIVITY_TIMELINE_ENTITY_TYPE_OPTIONS = [
  { value: "employee", label: "Empleado" },
  { value: "customer", label: "Cliente" },
  { value: "request", label: "Solicitud" },
  { value: "commercial_activity", label: "Actividad comercial" },
  { value: "attention", label: "Atención" },
  { value: "project", label: "Obra" },
  { value: "workorder", label: "Orden de trabajo" },
  { value: "crew", label: "Cuadrilla" },
] as const

export type ActivityTimelineGroupId =
  | "today"
  | "yesterday"
  | "this_week"
  | "older"

export const ACTIVITY_TIMELINE_GROUP_LABELS: Record<
  ActivityTimelineGroupId,
  string
> = {
  today: "Hoy",
  yesterday: "Ayer",
  this_week: "Esta semana",
  older: "Más antiguas",
}

/** Global Activity Engine filters. */
export const GLOBAL_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  company: true,
  employee: true,
  module: true,
  entityType: true,
  action: true,
  dateFrom: true,
  dateTo: true,
  search: true,
}

export const EMPLOYEE_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  dateFrom: true,
  dateTo: true,
  module: true,
  action: true,
  search: true,
}

export const CUSTOMER_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  dateFrom: true,
  dateTo: true,
  action: true,
}

export const REQUEST_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  dateFrom: true,
  dateTo: true,
  action: true,
}

export const WORK_ORDER_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  dateFrom: true,
  dateTo: true,
}

export const PROJECT_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  dateFrom: true,
  dateTo: true,
  action: true,
}

export const ATTENTION_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  dateFrom: true,
  dateTo: true,
  action: true,
}

export const CREW_TIMELINE_FILTERS: ActivityTimelineVisibleFilters = {
  dateFrom: true,
  dateTo: true,
  action: true,
  search: true,
}

export const EMPLOYEE_DAILY_REPORT_FILTERS: ActivityTimelineVisibleFilters = {
  module: true,
  action: true,
  search: true,
}
