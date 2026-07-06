export type MobileApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "SESSION_EXPIRED"
  | "USER_DISABLED"
  | "EMPLOYEE_NOT_FOUND"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_BLOCKED"
  | "WORK_TEAM_NOT_ASSIGNED"
  | "SHIFT_ALREADY_ACTIVE"
  | "SHIFT_NOT_ACTIVE"
  | "TASK_NOT_FOUND"
  | "TASK_INVALID_STATUS"
  | "TASK_LOCATION_OUT_OF_RANGE"
  | "TASK_LOCATION_REQUIRED"
  | "TASK_CHECKLIST_INCOMPLETE"
  | "UPLOAD_FAILED"
  | "INCIDENT_NOT_FOUND"
  | "INCIDENT_ALREADY_ACTIVE"
  | "INVALID_INCIDENT_STATUS"

export class MobileApiError extends Error {
  readonly code: MobileApiErrorCode
  readonly status: number

  constructor(code: MobileApiErrorCode, message: string, status: number) {
    super(message)
    this.name = "MobileApiError"
    this.code = code
    this.status = status
  }
}

export const MOBILE_API_ERROR_MESSAGES = {
  UNAUTHORIZED: "No autorizado",
  SESSION_EXPIRED: "Sesión expirada.",
  INVALID_CREDENTIALS: "Credenciales inválidas",
  USER_DISABLED: "Usuario deshabilitado",
  EMPLOYEE_NOT_FOUND: "Empleado inexistente",
  INTERNAL_ERROR: "Error interno",
} as const
