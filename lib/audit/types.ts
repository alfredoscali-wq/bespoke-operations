import type { SessionUser } from "@/lib/auth/types"

export const AUDIT_SEVERITIES = {
  INFO: "INFO",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
} as const

export type AuditSeverity =
  (typeof AUDIT_SEVERITIES)[keyof typeof AUDIT_SEVERITIES]

export const AUDIT_MODULES = {
  CLIENTES: "clientes",
  TAREAS: "tareas",
  OBRAS: "obras",
  RRHH: "rrhh",
  USUARIOS: "usuarios",
  SISTEMA: "sistema",
} as const

export type AuditModule = (typeof AUDIT_MODULES)[keyof typeof AUDIT_MODULES]

export const AUDIT_ENTITY_TYPES = {
  CUSTOMER: "customer",
  TASK: "task",
  PROJECT: "project",
  EMPLOYEE: "employee",
  CREW: "crew",
  USER: "user",
  SESSION: "session",
  MOBILE_DEVICE: "mobile_device",
  WORK_TEAM_SHIFT: "work_team_shift",
} as const

export type AuditEntityType =
  (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES]

export const AUDIT_ACTIONS = {
  CUSTOMER_CREATE: "CUSTOMER_CREATE",
  CUSTOMER_UPDATE: "CUSTOMER_UPDATE",
  CUSTOMER_VALIDATE: "CUSTOMER_VALIDATE",
  CUSTOMER_ACTIVATE: "CUSTOMER_ACTIVATE",
  CUSTOMER_ARCHIVE: "CUSTOMER_ARCHIVE",
  CUSTOMER_DELETE: "CUSTOMER_DELETE",
  CUSTOMER_DELETE_PERMANENT: "CUSTOMER_DELETE_PERMANENT",
  TASK_CREATE: "TASK_CREATE",
  TASK_UPDATE: "TASK_UPDATE",
  TASK_ASSIGN_CREW: "TASK_ASSIGN_CREW",
  TASK_RESCHEDULE: "TASK_RESCHEDULE",
  TASK_STATUS_VENCIDA: "TASK_STATUS_VENCIDA",
  TASK_STATUS_EN_CURSO: "TASK_STATUS_EN_CURSO",
  TASK_REQUEST_CLOSE: "TASK_REQUEST_CLOSE",
  TASK_FINISH: "TASK_FINISH",
  TASK_CLOSE: "TASK_CLOSE",
  TASK_DELETE: "TASK_DELETE",
  TASK_DELETE_PERMANENT: "TASK_DELETE_PERMANENT",
  PLANNING_CONFIRMED: "PLANNING_CONFIRMED",
  PROJECT_CREATE: "PROJECT_CREATE",
  PROJECT_UPDATE: "PROJECT_UPDATE",
  PROJECT_STATUS_CHANGE: "PROJECT_STATUS_CHANGE",
  PROJECT_ARCHIVE: "PROJECT_ARCHIVE",
  PROJECT_DELETE_PERMANENT: "PROJECT_DELETE_PERMANENT",
  EMPLOYEE_CREATE: "EMPLOYEE_CREATE",
  EMPLOYEE_UPDATE: "EMPLOYEE_UPDATE",
  EMPLOYEE_DEACTIVATE: "EMPLOYEE_DEACTIVATE",
  EMPLOYEE_REACTIVATE: "EMPLOYEE_REACTIVATE",
  CREW_CREATE: "CREW_CREATE",
  CREW_UPDATE: "CREW_UPDATE",
  CREW_ARCHIVE: "CREW_ARCHIVE",
  CREW_MEMBER_ADD: "CREW_MEMBER_ADD",
  CREW_MEMBER_REMOVE: "CREW_MEMBER_REMOVE",
  AVAILABILITY_CHANGE: "AVAILABILITY_CHANGE",
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_CREATE: "USER_CREATE",
  USER_PROVISION: "USER_PROVISION",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  USER_ROLE_CHANGE: "USER_ROLE_CHANGE",
  USER_DEACTIVATE: "USER_DEACTIVATE",
  USER_REACTIVATE: "USER_REACTIVATE",
  MOBILE_DEVICE_REGISTERED: "MOBILE_DEVICE_REGISTERED",
  MOBILE_DEVICE_ACTIVATED: "MOBILE_DEVICE_ACTIVATED",
  MOBILE_DEVICE_BLOCKED: "MOBILE_DEVICE_BLOCKED",
  SHIFT_STARTED: "SHIFT_STARTED",
  SHIFT_FINISHED: "SHIFT_FINISHED",
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export type AuditActor =
  | { kind: "user"; sessionUser: SessionUser }
  | { kind: "system" }

export type WriteAuditLogInput = {
  module: AuditModule
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  entityLabel?: string | null
  description: string
  severity?: AuditSeverity
  performedBy: AuditActor
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export type AuditLogEntry = {
  id: string
  module: AuditModule
  action: AuditAction | string
  entityType: AuditEntityType | string
  entityId: string | null
  entityLabel: string | null
  description: string
  severity: AuditSeverity
  performedByUserId: string | null
  performedByName: string
  performedByRole: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type AuditLogQuery = {
  companyId?: string
  module?: AuditModule
  action?: AuditAction | string
  entityType?: AuditEntityType | string
  entityId?: string
  severity?: AuditSeverity
  performedByUserId?: string
  search?: string
  entityLabel?: string
  otCode?: string
  customerQuery?: string
  projectQuery?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type AuditLogStats = {
  eventsToday: number
  activeUsersToday: number
  tasksCreatedToday: number
  tasksFinishedToday: number
  criticalToday: number
  loginsToday: number
}

export type AuditLogStatsQuery = Pick<AuditLogQuery, "companyId" | "from" | "to">

export type AuditLogQueryResult = {
  entries: AuditLogEntry[]
  total: number
  page: number
  limit: number
}
