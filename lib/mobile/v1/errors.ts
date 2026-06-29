export type MobileApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CREDENTIALS"
  | "USER_DISABLED"
  | "EMPLOYEE_NOT_FOUND"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED"

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
  INVALID_CREDENTIALS: "Credenciales inválidas",
  USER_DISABLED: "Usuario deshabilitado",
  EMPLOYEE_NOT_FOUND: "Empleado inexistente",
  INTERNAL_ERROR: "Error interno",
} as const
