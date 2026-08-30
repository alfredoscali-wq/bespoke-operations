export type NetworkApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "AGENT_NOT_FOUND"
  | "ENROLLMENT_EXPIRED"
  | "ENROLLMENT_CONSUMED"
  | "JOB_NOT_FOUND"
  | "JOB_NOT_EXECUTABLE"
  | "INTERNAL_ERROR"

export class NetworkApiError extends Error {
  readonly code: NetworkApiErrorCode
  readonly status: number

  constructor(code: NetworkApiErrorCode, message: string, status: number) {
    super(message)
    this.name = "NetworkApiError"
    this.code = code
    this.status = status
  }
}

export const NETWORK_API_ERROR_MESSAGES = {
  UNAUTHORIZED: "No autorizado",
  AGENT_NOT_FOUND: "Network Agent no encontrado.",
  ENROLLMENT_EXPIRED: "El token de enrollment expiró.",
  ENROLLMENT_CONSUMED: "El token de enrollment ya fue utilizado.",
  JOB_NOT_FOUND: "Job no encontrado.",
  JOB_NOT_EXECUTABLE: "El job no está autorizado para este agent.",
  INTERNAL_ERROR: "Error interno",
} as const
