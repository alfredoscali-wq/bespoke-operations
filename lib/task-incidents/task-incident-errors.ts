export type TaskIncidentErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "DUPLICATE_ACTIVE"
  | "INVALID_STATUS"
  | "FORBIDDEN"
  | "UNKNOWN"

export class TaskIncidentError extends Error {
  readonly code: TaskIncidentErrorCode
  readonly httpStatus: number

  constructor(
    code: TaskIncidentErrorCode,
    message: string,
    httpStatus: number
  ) {
    super(message)
    this.name = "TaskIncidentError"
    this.code = code
    this.httpStatus = httpStatus
  }
}

export function mapRepositoryErrorToTaskIncidentError(error: {
  code: string
  message: string
}): TaskIncidentError {
  switch (error.code) {
    case "NOT_FOUND":
      return new TaskIncidentError("NOT_FOUND", error.message, 404)
    case "DUPLICATE_ACTIVE":
      return new TaskIncidentError("DUPLICATE_ACTIVE", error.message, 409)
    case "VALIDATION":
      return new TaskIncidentError("VALIDATION", error.message, 400)
    case "WORKFLOW":
      return new TaskIncidentError("INVALID_STATUS", error.message, 409)
    case "FORBIDDEN":
      return new TaskIncidentError("FORBIDDEN", error.message, 403)
    default:
      return new TaskIncidentError(
        "UNKNOWN",
        error.message || "No fue posible completar la operación.",
        500
      )
  }
}
