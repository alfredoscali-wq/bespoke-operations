import { MobileApiError } from "@/lib/mobile/v1/errors"
import {
  readRequiredFormFile,
  readRequiredFormString,
} from "@/lib/mobile/v1/tasks/validate-task-execution-request"
import type { MobileIncidentPhotoUploadRequest } from "@/lib/mobile/v1/incidents/types"
import { validateMobileIncidentIdParam } from "@/lib/mobile/v1/incidents/validate-incident-request"

function describeFormFieldValue(value: FormDataEntryValue | null): string {
  if (value === null) {
    return "missing"
  }

  if (typeof value === "string") {
    return `string(length=${value.length})`
  }

  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function"
  ) {
    const blob = value as Blob
    const fileName =
      value instanceof File && value.name.trim() ? value.name : "<unnamed>"
    return `blob(name=${fileName}, type=${blob.type || "unknown"}, size=${blob.size})`
  }

  return typeof value
}

export function parseMobileIncidentPhotoForm(
  formData: FormData,
  options?: {
    requestId?: string
    contentType?: string | null
  }
): MobileIncidentPhotoUploadRequest {
  const receivedFields = Array.from(formData.keys())

  console.debug("[Mobile API incident-photos]", {
    requestId: options?.requestId,
    contentType: options?.contentType,
    receivedFields,
    fileField: describeFormFieldValue(formData.get("file")),
    deviceIdField: describeFormFieldValue(formData.get("deviceId")),
  })

  return {
    deviceId: readRequiredFormString(formData, "deviceId"),
    file: readRequiredFormFile(formData, "file"),
  }
}

export function validateMobileIncidentPhotoRouteParam(
  incidentId: string
): string {
  try {
    return validateMobileIncidentIdParam(incidentId)
  } catch (error) {
    if (error instanceof MobileApiError) {
      throw error
    }

    throw new MobileApiError("INVALID_REQUEST", "Identificador de incidencia inválido.", 400)
  }
}
