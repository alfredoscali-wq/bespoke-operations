import type {
  ActivityAction,
  ActivityActorType,
  ActivityEntityType,
  ActivityModule,
  ActivityOrigin,
  ActivitySeverity,
} from "@/lib/activity/types"

export const ACTIVITY_VIEWER_PAGE_SIZE = 50

export type ActivityViewerQuery = {
  companyId: string
  from?: string
  to?: string
  /** Exact employee id when selected from filters. */
  employeeId?: string
  /** Free-text user name / employee id search. */
  userSearch?: string
  /** Company area / role code (e.g. tecnica, rrhh). */
  area?: string
  module?: ActivityModule
  action?: string
  origin?: ActivityOrigin
  offset?: number
  limit?: number
}

export type ActivityViewerEntry = {
  id: string
  createdAt: string
  employeeId: string | null
  userName: string
  companyId: string
  companyName: string
  areaCode: string | null
  areaLabel: string
  module: ActivityModule | string
  action: ActivityAction | string
  entityType: ActivityEntityType | string
  entityId: string | null
  detail: string
  origin: ActivityOrigin | string
  severity: ActivitySeverity | string
  correlationId: string | null
  metadata: Record<string, unknown>
  actorType: ActivityActorType | string
}

export type ActivityViewerQueryResult = {
  entries: ActivityViewerEntry[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
}

export type ActivityViewerStats = {
  eventsToday: number
  eventsLastHour: number
  activeUsersToday: number
  modulesActiveToday: number
}
