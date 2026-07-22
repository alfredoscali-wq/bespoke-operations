export const ACTIVITY_SEVERITIES = {
  INFO: "INFO",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
} as const

export type ActivitySeverity =
  (typeof ACTIVITY_SEVERITIES)[keyof typeof ACTIVITY_SEVERITIES]

export const ACTIVITY_ORIGINS = {
  WEB: "web",
  MOBILE: "mobile",
  API: "api",
  CRON: "cron",
  SYSTEM: "system",
} as const

export type ActivityOrigin =
  (typeof ACTIVITY_ORIGINS)[keyof typeof ACTIVITY_ORIGINS]

export const ACTIVITY_ACTOR_TYPES = {
  USER: "user",
  EMPLOYEE: "employee",
  SYSTEM: "system",
  SERVICE: "service",
} as const

export type ActivityActorType =
  (typeof ACTIVITY_ACTOR_TYPES)[keyof typeof ACTIVITY_ACTOR_TYPES]

/** Product modules for Activity Engine (catalog). */
export const ACTIVITY_MODULES = {
  TASKS: "tasks",
  PROJECTS: "projects",
  PLANNING: "planning",
  ATENCION: "atencion",
  CUSTOMERS: "customers",
  RRHH: "rrhh",
  CREWS: "crews",
  USERS: "users",
  INCIDENTS: "incidents",
  MOBILE: "mobile",
  DEVICES: "devices",
  EVIDENCE: "evidence",
  MATERIALS: "materials",
  REPORTS: "reports",
  SETTINGS: "settings",
  SYSTEM: "system",
} as const

export type ActivityModule =
  (typeof ACTIVITY_MODULES)[keyof typeof ACTIVITY_MODULES]

export const ACTIVITY_ENTITY_TYPES = {
  TASK: "task",
  PROJECT: "project",
  PLANNING_DAY: "planning_day",
  CUSTOMER_ATENCION: "customer_atencion",
  CUSTOMER: "customer",
  EMPLOYEE: "employee",
  CREW: "crew",
  USER: "user",
  SESSION: "session",
  INCIDENT: "incident",
  MOBILE_DEVICE: "mobile_device",
  WORK_TEAM_SHIFT: "work_team_shift",
  EVIDENCE: "evidence",
  MATERIAL: "material",
  SETTING: "setting",
  REPORT_RUN: "report_run",
  IMPORT_BATCH: "import_batch",
  AUDIT_EXPORT: "audit_export",
} as const

export type ActivityEntityType =
  (typeof ACTIVITY_ENTITY_TYPES)[keyof typeof ACTIVITY_ENTITY_TYPES]

/**
 * Official Activity Engine action codes (Fase 2 master catalog).
 * Reserved SALE_ and BILLING_ codes are intentionally omitted until those modules exist.
 */
export const ACTIVITY_ACTIONS = {
  // OT
  TASK_CREATE: "TASK_CREATE",
  TASK_UPDATE: "TASK_UPDATE",
  TASK_ASSIGN_CREW: "TASK_ASSIGN_CREW",
  TASK_UNASSIGN_CREW: "TASK_UNASSIGN_CREW",
  TASK_RESCHEDULE: "TASK_RESCHEDULE",
  TASK_PRIORITY_CHANGE: "TASK_PRIORITY_CHANGE",
  TASK_DURATION_CHANGE: "TASK_DURATION_CHANGE",
  TASK_MATERIALS_CHANGE: "TASK_MATERIALS_CHANGE",
  TASK_START: "TASK_START",
  TASK_SUBMIT_FOR_APPROVAL: "TASK_SUBMIT_FOR_APPROVAL",
  TASK_APPROVE: "TASK_APPROVE",
  TASK_REJECT: "TASK_REJECT",
  TASK_CANCEL: "TASK_CANCEL",
  TASK_MARK_OVERDUE: "TASK_MARK_OVERDUE",
  TASK_DELETE: "TASK_DELETE",
  TASK_DELETE_PERMANENT: "TASK_DELETE_PERMANENT",
  TASK_FORCE_DELETE: "TASK_FORCE_DELETE",
  TASK_REFERENCE_PHOTO_DELETE: "TASK_REFERENCE_PHOTO_DELETE",
  TASK_CHECKLIST_COMPLETE: "TASK_CHECKLIST_COMPLETE",
  TASK_CUSTOMER_SIGN: "TASK_CUSTOMER_SIGN",

  // Obras
  PROJECT_CREATE: "PROJECT_CREATE",
  PROJECT_UPDATE: "PROJECT_UPDATE",
  PROJECT_START: "PROJECT_START",
  PROJECT_FINISH: "PROJECT_FINISH",
  PROJECT_CANCEL: "PROJECT_CANCEL",
  PROJECT_ARCHIVE: "PROJECT_ARCHIVE",
  PROJECT_DELETE_PERMANENT: "PROJECT_DELETE_PERMANENT",
  PROJECT_FORCE_DELETE: "PROJECT_FORCE_DELETE",

  // Planificación
  PLANNING_CONFIRM: "PLANNING_CONFIRM",
  PLANNING_ORDER_CHANGE: "PLANNING_ORDER_CHANGE",
  PLANNING_CREW_CHANGE: "PLANNING_CREW_CHANGE",
  PLANNING_RETURN: "PLANNING_RETURN",

  // Atención
  ATENCION_CREATE: "ATENCION_CREATE",
  ATENCION_START_MANAGEMENT: "ATENCION_START_MANAGEMENT",
  ATENCION_REGISTER_INTERACTION: "ATENCION_REGISTER_INTERACTION",
  ATENCION_DEFER: "ATENCION_DEFER",
  ATENCION_TRANSFER: "ATENCION_TRANSFER",
  ATENCION_RESOLVE: "ATENCION_RESOLVE",
  ATENCION_LINK_TASK: "ATENCION_LINK_TASK",
  ATENCION_RETENTION_UPDATE: "ATENCION_RETENTION_UPDATE",
  ATENCION_MOROSO_UPDATE: "ATENCION_MOROSO_UPDATE",
  ATENCION_CLOSE: "ATENCION_CLOSE",
  ATENCION_DELETE_PERMANENT: "ATENCION_DELETE_PERMANENT",
  ATENCION_MANAGEMENT_RELEASED: "ATENCION_MANAGEMENT_RELEASED",

  // Clientes
  CUSTOMER_CREATE: "CUSTOMER_CREATE",
  CUSTOMER_UPDATE: "CUSTOMER_UPDATE",
  CUSTOMER_ADDRESS_CHANGE: "CUSTOMER_ADDRESS_CHANGE",
  CUSTOMER_PLAN_CHANGE: "CUSTOMER_PLAN_CHANGE",
  CUSTOMER_TECHNOLOGY_CHANGE: "CUSTOMER_TECHNOLOGY_CHANGE",
  CUSTOMER_VALIDATE: "CUSTOMER_VALIDATE",
  CUSTOMER_ACTIVATE: "CUSTOMER_ACTIVATE",
  CUSTOMER_ARCHIVE: "CUSTOMER_ARCHIVE",
  CUSTOMER_DELETE: "CUSTOMER_DELETE",
  CUSTOMER_DELETE_PERMANENT: "CUSTOMER_DELETE_PERMANENT",
  CUSTOMER_IMPORT: "CUSTOMER_IMPORT",

  // RRHH
  EMPLOYEE_CREATE: "EMPLOYEE_CREATE",
  EMPLOYEE_UPDATE: "EMPLOYEE_UPDATE",
  EMPLOYEE_DEACTIVATE: "EMPLOYEE_DEACTIVATE",
  EMPLOYEE_REACTIVATE: "EMPLOYEE_REACTIVATE",
  EMPLOYEE_AVAILABILITY_CHANGE: "EMPLOYEE_AVAILABILITY_CHANGE",

  // Cuadrillas
  CREW_CREATE: "CREW_CREATE",
  CREW_UPDATE: "CREW_UPDATE",
  CREW_ARCHIVE: "CREW_ARCHIVE",
  CREW_MEMBER_ADD: "CREW_MEMBER_ADD",
  CREW_MEMBER_REMOVE: "CREW_MEMBER_REMOVE",

  // Usuarios
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_CREATE: "USER_CREATE",
  USER_PROVISION: "USER_PROVISION",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  USER_ROLE_CHANGE: "USER_ROLE_CHANGE",
  USER_DEACTIVATE: "USER_DEACTIVATE",
  USER_REACTIVATE: "USER_REACTIVATE",

  // Incidencias
  INCIDENT_CREATE: "INCIDENT_CREATE",
  INCIDENT_SUPERVISOR_ACTION: "INCIDENT_SUPERVISOR_ACTION",
  INCIDENT_RESOLVE: "INCIDENT_RESOLVE",
  INCIDENT_CLOSE: "INCIDENT_CLOSE",

  // Mobile / devices / shifts
  SHIFT_START: "SHIFT_START",
  SHIFT_FINISH: "SHIFT_FINISH",
  DEVICE_REGISTER: "DEVICE_REGISTER",
  DEVICE_ACTIVATE: "DEVICE_ACTIVATE",
  DEVICE_BLOCK: "DEVICE_BLOCK",

  // Evidencias / materiales / settings / reports / system
  EVIDENCE_UPLOAD: "EVIDENCE_UPLOAD",
  EVIDENCE_VOID: "EVIDENCE_VOID",
  MATERIAL_CREATE: "MATERIAL_CREATE",
  MATERIAL_UPDATE: "MATERIAL_UPDATE",
  MATERIAL_DELETE: "MATERIAL_DELETE",
  SETTINGS_UPDATE: "SETTINGS_UPDATE",
  REPORT_RUN: "REPORT_RUN",
  REPORT_SEND: "REPORT_SEND",
  REPORT_RESEND: "REPORT_RESEND",
  SYSTEM_AUDIT_EXPORT: "SYSTEM_AUDIT_EXPORT",
  FORCE_DELETE: "FORCE_DELETE",
} as const

export type ActivityAction =
  (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS]

export type ActivityActionDefinition = {
  module: ActivityModule
  entityType: ActivityEntityType
  severity: ActivitySeverity
  label: string
}

export type RecordActivityEventInput = {
  companyId: string
  employeeId?: string | null
  actorType: ActivityActorType
  module: ActivityModule
  entityType: ActivityEntityType
  entityId?: string | null
  action: ActivityAction
  detail?: string | null
  metadata?: Record<string, unknown>
  origin: ActivityOrigin
  correlationId?: string | null
  severity?: ActivitySeverity
}

export type ActivityEventRow = {
  id: string
  companyId: string
  employeeId: string | null
  actorType: ActivityActorType
  module: ActivityModule
  entityType: ActivityEntityType
  entityId: string | null
  action: ActivityAction
  detail: string
  metadata: Record<string, unknown>
  origin: ActivityOrigin
  correlationId: string | null
  severity: ActivitySeverity
  createdAt: string
}

/** Payload for RPC `record_activity_event`. */
export type ActivityEventRpcArgs = {
  p_company_id: string
  p_employee_id: string | null
  p_actor_type: ActivityActorType
  p_module: ActivityModule
  p_entity_type: ActivityEntityType
  p_entity_id: string | null
  p_action: ActivityAction
  p_detail: string
  p_metadata: Record<string, unknown>
  p_origin: ActivityOrigin
  p_correlation_id: string | null
  p_severity: ActivitySeverity
}
