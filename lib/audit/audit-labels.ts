import {
  AUDIT_MODULES,
  AUDIT_SEVERITIES,
  type AuditAction,
  type AuditEntityType,
  type AuditModule,
  type AuditSeverity,
} from "@/lib/audit/types"

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  [AUDIT_MODULES.CLIENTES]: "Clientes",
  [AUDIT_MODULES.TAREAS]: "Órdenes de Trabajo",
  [AUDIT_MODULES.OBRAS]: "Obras",
  [AUDIT_MODULES.RRHH]: "RRHH",
  [AUDIT_MODULES.USUARIOS]: "Usuarios",
  [AUDIT_MODULES.SISTEMA]: "Sistema",
}

export const AUDIT_ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  customer: "Cliente",
  task: "Orden de Trabajo",
  project: "Obra",
  employee: "Empleado",
  crew: "Cuadrilla",
  user: "Usuario",
  session: "Sesión",
  mobile_device: "Dispositivo móvil",
  work_team_shift: "Jornada operativa",
  incident: "Incidencia",
}

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  [AUDIT_SEVERITIES.INFO]: "Info",
  [AUDIT_SEVERITIES.WARNING]: "Advertencia",
  [AUDIT_SEVERITIES.CRITICAL]: "Crítico",
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CUSTOMER_CREATE: "Cliente creado",
  CUSTOMER_UPDATE: "Cliente editado",
  CUSTOMER_VALIDATE: "Cliente validado",
  CUSTOMER_ACTIVATE: "Cliente activado",
  CUSTOMER_ARCHIVE: "Cliente archivado",
  CUSTOMER_DELETE: "Cliente eliminado (sin actividad operativa)",
  CUSTOMER_DELETE_PERMANENT: "Cliente eliminado definitivamente",
  TASK_CREATE: "Orden de trabajo creada",
  TASK_UPDATE: "Orden de trabajo editada",
  TASK_ASSIGN_CREW: "Cuadrilla asignada a orden de trabajo",
  TASK_RESCHEDULE: "Orden de trabajo reprogramada",
  TASK_STATUS_VENCIDA: "Orden de trabajo marcada como Vencida",
  TASK_STATUS_EN_CURSO: "Orden de trabajo en curso",
  TASK_REQUEST_CLOSE: "Solicitud de cierre de orden de trabajo",
  TASK_FINISH: "Orden de trabajo finalizada",
  TASK_CLOSE: "Orden de trabajo cerrada",
  TASK_DELETE: "Orden de trabajo eliminada",
  TASK_DELETE_PERMANENT: "Orden de trabajo eliminada definitivamente",
  PLANNING_CONFIRMED: "Planificación confirmada",
  PROJECT_CREATE: "Obra creada",
  PROJECT_UPDATE: "Obra editada",
  PROJECT_STATUS_CHANGE: "Cambio de estado de obra",
  PROJECT_ARCHIVE: "Obra archivada",
  PROJECT_DELETE_PERMANENT: "Obra eliminada definitivamente",
  EMPLOYEE_CREATE: "Alta de empleado",
  EMPLOYEE_UPDATE: "Empleado editado",
  EMPLOYEE_DEACTIVATE: "Baja de empleado",
  EMPLOYEE_REACTIVATE: "Empleado reactivado",
  CREW_CREATE: "Cuadrilla creada",
  CREW_UPDATE: "Cuadrilla editada",
  CREW_ARCHIVE: "Cuadrilla archivada",
  CREW_MEMBER_ADD: "Operario agregado a cuadrilla",
  CREW_MEMBER_REMOVE: "Operario removido de cuadrilla",
  AVAILABILITY_CHANGE: "Cambio de disponibilidad",
  USER_LOGIN: "Inicio de sesión",
  USER_LOGOUT: "Cierre de sesión",
  USER_CREATE: "Usuario creado",
  USER_PROVISION: "Acceso provisionado",
  USER_DEACTIVATE: "Usuario desactivado",
  USER_REACTIVATE: "Usuario reactivado",
  USER_PASSWORD_RESET: "Reset de contraseña",
  USER_ROLE_CHANGE: "Cambio de rol",
  MOBILE_DEVICE_REGISTERED: "Dispositivo registrado",
  MOBILE_DEVICE_ACTIVATED: "Dispositivo activado",
  MOBILE_DEVICE_BLOCKED: "Dispositivo bloqueado",
  SHIFT_STARTED: "Jornada iniciada",
  SHIFT_FINISHED: "Jornada finalizada",
  INCIDENT_CREATED: "Incidencia reportada",
  INCIDENT_SUPERVISOR_ACTION: "Acción de supervisor sobre incidencia",
  INCIDENT_CLOSED: "Incidencia cerrada",
}

export function formatAuditModuleLabel(module: AuditModule | string): string {
  return AUDIT_MODULE_LABELS[module as AuditModule] ?? module
}

export function formatAuditEntityTypeLabel(
  entityType: AuditEntityType | string
): string {
  return AUDIT_ENTITY_TYPE_LABELS[entityType as AuditEntityType] ?? entityType
}

export function formatAuditActionLabel(action: AuditAction | string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action
}

export function formatAuditSeverityLabel(severity: AuditSeverity | string): string {
  return AUDIT_SEVERITY_LABELS[severity as AuditSeverity] ?? severity
}
