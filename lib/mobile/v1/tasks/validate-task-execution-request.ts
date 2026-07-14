import { MobileApiError } from "@/lib/mobile/v1/errors"
import type {
  MobileTaskChecklistPhotoRequest,
  MobileTaskChecklistResponseRequest,
} from "@/lib/mobile/v1/tasks/types"

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
  trabajoRealizado: string
} {
  if (!body || typeof body !== "object") {
    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)
  }

  const record = body as Record<string, unknown>

  return {
    deviceId: readRequiredString(record.deviceId, "deviceId"),
    trabajoRealizado: readRequiredString(
      record.trabajoRealizado,
      "trabajoRealizado"
    ),
  }
}

function readOptionalTrimmedString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Campo inválido: ${field}.`,
      400
    )
  }

  const trimmed = value.trim()
  return trimmed || null
}

export function validateMobileTaskReportIncidentRequest(body: unknown): {
  deviceId: string
  incidentTypeCode: string
  observation: string | null
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
    observation: readOptionalTrimmedString(record.observation, "observation"),
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

function isUploadBlob(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  )
}

function normalizeUploadedFormFile(value: Blob, fallbackName: string): File {
  if (value instanceof File) {
    return value
  }

  const fileName =
    typeof (value as File).name === "string" && (value as File).name.trim()
      ? (value as File).name.trim()
      : fallbackName

  return new File([value], fileName, {
    type: value.type || "application/octet-stream",
  })
}

function describeFormFieldValue(value: FormDataEntryValue | null): string {
  if (value === null) {
    return "missing"
  }

  if (typeof value === "string") {
    return `string(length=${value.length})`
  }

  if (isUploadBlob(value)) {
    const fileName =
      value instanceof File && value.name.trim() ? value.name : "<unnamed>"
    return `blob(name=${fileName}, type=${value.type || "unknown"}, size=${value.size})`
  }

  return typeof value
}

export function readRequiredFormFile(formData: FormData, field: string): File {
  const value = formData.get(field)

  if (!isUploadBlob(value) || value.size <= 0) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      `Archivo requerido: ${field} (${describeFormFieldValue(value)}).`,
      400
    )
  }

  return normalizeUploadedFormFile(value, `${field}.jpg`)
}

export function parseMobileTaskChecklistPhotoForm(
  formData: FormData,
  options?: {
    requestId?: string
    contentType?: string | null
  }
): MobileTaskChecklistPhotoRequest {
  const receivedFields = Array.from(formData.keys())

  console.debug("[Mobile API checklist-photos]", {
    requestId: options?.requestId,
    contentType: options?.contentType,
    receivedFields,
    fileField: describeFormFieldValue(formData.get("file")),
    deviceIdField: describeFormFieldValue(formData.get("deviceId")),
    checklistItemIdField: describeFormFieldValue(
      formData.get("checklistItemId")
    ),
  })

  return {
    deviceId: readRequiredFormString(formData, "deviceId"),
    checklistItemId: readRequiredFormString(formData, "checklistItemId"),
    file: readRequiredFormFile(formData, "file"),
  }
}
