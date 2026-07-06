import { isValidAuditEntityId } from "@/lib/audit/entity-id"
import {
  isTaskIncidentStatus,
  TERMINAL_TASK_INCIDENT_STATUSES,
} from "@/lib/task-incidents/task-incident-status-transitions"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"
import type {
  AddIncidentEventRequest,
  AddIncidentPhotoRequest,
  CreateIncidentRequest,
  TaskIncidentStatus,
  UpdateIncidentStatusRequest,
} from "@/lib/types/task-incidents"

export const TASK_INCIDENT_COMMENT_MAX_LENGTH = 2000
export const TASK_INCIDENT_EVENT_TYPE_MAX_LENGTH = 100
export const TASK_INCIDENT_STORAGE_PATH_MAX_LENGTH = 500
export const TASK_INCIDENT_FILE_NAME_MAX_LENGTH = 180

export const TASK_INCIDENT_EVENT_CREATED = "CREATED"
export const TASK_INCIDENT_EVENT_STATUS_CHANGED = "STATUS_CHANGED"

export function assertValidUuid(value: string, field: string): string {
  const trimmed = value.trim()

  if (!isValidAuditEntityId(trimmed)) {
    throw new TaskIncidentError(
      "VALIDATION",
      `Identificador inválido: ${field}.`,
      400
    )
  }

  return trimmed
}

export function validateOptionalComment(
  value: string | null | undefined,
  field = "comment"
): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new TaskIncidentError(
      "VALIDATION",
      `Campo inválido: ${field}.`,
      400
    )
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (trimmed.length > TASK_INCIDENT_COMMENT_MAX_LENGTH) {
    throw new TaskIncidentError(
      "VALIDATION",
      `El comentario supera el límite de ${TASK_INCIDENT_COMMENT_MAX_LENGTH} caracteres.`,
      400
    )
  }

  return trimmed
}

function readOptionalBoolean(
  value: unknown,
  field: string
): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "boolean") {
    throw new TaskIncidentError(
      "VALIDATION",
      `Campo inválido: ${field}.`,
      400
    )
  }

  return value
}

function readOptionalNullableString(
  value: unknown,
  field: string
): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new TaskIncidentError(
      "VALIDATION",
      `Campo inválido: ${field}.`,
      400
    )
  }

  return value.trim() || null
}

function readOptionalNumber(
  value: unknown,
  field: string
): number | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TaskIncidentError(
      "VALIDATION",
      `Campo inválido: ${field}.`,
      400
    )
  }

  return value
}

export function validateCreateIncidentRequest(
  body: unknown
): CreateIncidentRequest {
  if (!body || typeof body !== "object") {
    throw new TaskIncidentError("VALIDATION", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  return {
    taskId: assertValidUuid(String(record.taskId ?? ""), "taskId"),
    employeeId: assertValidUuid(String(record.employeeId ?? ""), "employeeId"),
    crewId:
      record.crewId === undefined || record.crewId === null
        ? null
        : assertValidUuid(String(record.crewId), "crewId"),
    incidentTypeId: assertValidUuid(
      String(record.incidentTypeId ?? ""),
      "incidentTypeId"
    ),
    comment: validateOptionalComment(record.comment as string | null | undefined),
    canContinue: readOptionalBoolean(record.canContinue, "canContinue"),
    requiresSupervisorAction: readOptionalBoolean(
      record.requiresSupervisorAction,
      "requiresSupervisorAction"
    ),
  }
}

export function validateUpdateIncidentStatusRequest(
  body: unknown
): UpdateIncidentStatusRequest {
  if (!body || typeof body !== "object") {
    throw new TaskIncidentError("VALIDATION", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>
  const statusValue = String(record.status ?? "")

  if (!isTaskIncidentStatus(statusValue)) {
    throw new TaskIncidentError(
      "VALIDATION",
      "Estado de incidencia inválido.",
      400
    )
  }

  return {
    status: statusValue,
    comment: validateOptionalComment(record.comment as string | null | undefined),
    canContinue: readOptionalBoolean(record.canContinue, "canContinue"),
    requiresSupervisorAction: readOptionalBoolean(
      record.requiresSupervisorAction,
      "requiresSupervisorAction"
    ),
  }
}

export function validateAddIncidentPhotoRequest(
  body: unknown
): AddIncidentPhotoRequest {
  if (!body || typeof body !== "object") {
    throw new TaskIncidentError("VALIDATION", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  if (typeof record.storagePath !== "string" || !record.storagePath.trim()) {
    throw new TaskIncidentError(
      "VALIDATION",
      "Campo requerido: storagePath.",
      400
    )
  }

  const storagePath = record.storagePath.trim()

  if (storagePath.length > TASK_INCIDENT_STORAGE_PATH_MAX_LENGTH) {
    throw new TaskIncidentError(
      "VALIDATION",
      `storagePath supera el límite de ${TASK_INCIDENT_STORAGE_PATH_MAX_LENGTH} caracteres.`,
      400
    )
  }

  const fileName = readOptionalNullableString(record.fileName, "fileName")

  if (fileName && fileName.length > TASK_INCIDENT_FILE_NAME_MAX_LENGTH) {
    throw new TaskIncidentError(
      "VALIDATION",
      `fileName supera el límite de ${TASK_INCIDENT_FILE_NAME_MAX_LENGTH} caracteres.`,
      400
    )
  }

  return {
    storagePath,
    thumbnailPath: readOptionalNullableString(
      record.thumbnailPath,
      "thumbnailPath"
    ),
    fileName,
    mimeType: readOptionalNullableString(record.mimeType, "mimeType"),
    sizeBytes: readOptionalNumber(record.sizeBytes, "sizeBytes"),
  }
}

export function validateAddIncidentEventRequest(
  body: unknown
): AddIncidentEventRequest {
  if (!body || typeof body !== "object") {
    throw new TaskIncidentError("VALIDATION", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  if (typeof record.eventType !== "string" || !record.eventType.trim()) {
    throw new TaskIncidentError(
      "VALIDATION",
      "Campo requerido: eventType.",
      400
    )
  }

  const eventType = record.eventType.trim()

  if (eventType.length > TASK_INCIDENT_EVENT_TYPE_MAX_LENGTH) {
    throw new TaskIncidentError(
      "VALIDATION",
      `eventType supera el límite de ${TASK_INCIDENT_EVENT_TYPE_MAX_LENGTH} caracteres.`,
      400
    )
  }

  return {
    eventType,
    comment: validateOptionalComment(record.comment as string | null | undefined),
  }
}

export function validateIncidentIdParam(incidentId: string): string {
  return assertValidUuid(incidentId, "incidentId")
}

export function parseOptionalTaskIncidentStatus(
  value: string | null
): TaskIncidentStatus | undefined {
  if (!value) {
    return undefined
  }

  if (!isTaskIncidentStatus(value)) {
    throw new TaskIncidentError(
      "VALIDATION",
      "Estado de incidencia inválido.",
      400
    )
  }

  return value
}

export function parseOptionalBooleanQuery(
  value: string | null
): boolean | undefined {
  if (!value) {
    return undefined
  }

  if (value === "true" || value === "1") {
    return true
  }

  if (value === "false" || value === "0") {
    return false
  }

  throw new TaskIncidentError(
    "VALIDATION",
    "Parámetro booleano inválido.",
    400
  )
}

export function isTerminalStatus(status: TaskIncidentStatus): boolean {
  return TERMINAL_TASK_INCIDENT_STATUSES.includes(status)
}
