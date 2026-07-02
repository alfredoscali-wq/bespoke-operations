import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileTaskChecklistResponseRequest } from "@/lib/mobile/v1/tasks/types"

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

function readOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "boolean") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Campo inválido: ${field}.`,
      400
    )
  }

  return value
}

function readOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new MobileApiError("INVALID_REQUEST", "Valor de texto inválido.", 400)
  }

  return value
}

export function validateMobileTaskChecklistResponseRequest(
  body: unknown
): MobileTaskChecklistResponseRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  return {
    deviceId: readRequiredString(record.deviceId, "deviceId"),
    itemId: readRequiredString(record.itemId, "itemId"),
    confirmed: readOptionalBoolean(record.confirmed, "confirmed"),
    textValue: readOptionalString(record.textValue),
  }
}

export function validateMobileTaskSubmitRequest(body: unknown): {
  deviceId: string
} {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  return {
    deviceId: readRequiredString(record.deviceId, "deviceId"),
  }
}

export function validateMobileTaskReportIncidentRequest(body: unknown): {
  deviceId: string
  incidentTypeCode: string
  observation: string
  photoIds?: string[]
} {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>
  const photoIds = Array.isArray(record.photoIds)
    ? record.photoIds.filter((item): item is string => typeof item === "string")
    : undefined

  return {
    deviceId: readRequiredString(record.deviceId, "deviceId"),
    incidentTypeCode: readRequiredString(record.incidentTypeCode, "incidentTypeCode"),
    observation: readRequiredString(record.observation, "observation"),
    ...(photoIds && photoIds.length > 0 ? { photoIds } : {}),
  }
}

export function readRequiredFormString(formData: FormData, field: string): string {
  const value = formData.get(field)

  if (typeof value !== "string" || !value.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Campo requerido: ${field}.`,
      400
    )
  }

  return value.trim()
}

export function readRequiredFormFile(formData: FormData, field: string): File {
  const value = formData.get(field)

  if (!(value instanceof File) || value.size <= 0) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Archivo requerido: ${field}.`,
      400
    )
  }

  return value
}
