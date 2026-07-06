import { MobileApiError } from "@/lib/mobile/v1/errors"
import {
  assertValidUuid,
  validateCreateIncidentRequest,
  validateIncidentIdParam,
} from "@/lib/task-incidents/validate-task-incident-input"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"
import type { CreateIncidentRequest } from "@/lib/types/task-incidents"

function mapValidationError(error: unknown): never {
  if (error instanceof TaskIncidentError) {
    throw new MobileApiError("INVALID_REQUEST", error.message, error.httpStatus)
  }

  throw error
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Campo requerido: ${field}.`,
      400
    )
  }

  return value.trim()
}

export type MobileCreateIncidentRequest = CreateIncidentRequest & {
  deviceId: string
}

export function validateMobileCreateIncidentRequest(
  body: unknown
): MobileCreateIncidentRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>
  const deviceId = readRequiredString(record.deviceId, "deviceId")

  let request: CreateIncidentRequest

  try {
    request = validateCreateIncidentRequest(body)
  } catch (error) {
    mapValidationError(error)
  }

  return {
    ...request,
    deviceId,
  }
}

export function validateMobileIncidentIdParam(incidentId: string): string {
  try {
    return validateIncidentIdParam(incidentId)
  } catch (error) {
    if (error instanceof Error) {
      throw new MobileApiError("INVALID_REQUEST", error.message, 400)
    }

    throw error
  }
}

export function validateMobileTaskIdParam(taskId: string): string {
  try {
    return assertValidUuid(taskId, "taskId")
  } catch (error) {
    if (error instanceof Error) {
      throw new MobileApiError("INVALID_REQUEST", error.message, 400)
    }

    throw error
  }
}
