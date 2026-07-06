export const TASK_INCIDENT_PHOTOS_STORAGE_BUCKET = "task-incident-photos"

export const TASK_INCIDENT_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const

export const TASK_INCIDENT_PHOTO_MAX_SIZE_BYTES = 52428800

const MAX_FILE_NAME_LENGTH = 180

export function sanitizeTaskIncidentPhotoFileName(fileName: string): string {
  const trimmed = fileName.trim()
  const baseName = trimmed.replace(/^-+|-+$/g, "") || "photo"
  const normalized = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/-+$/g, "")

  if (normalized.length <= MAX_FILE_NAME_LENGTH) {
    return normalized
  }

  const extensionIndex = normalized.lastIndexOf(".")
  if (extensionIndex <= 0) {
    return normalized.slice(0, MAX_FILE_NAME_LENGTH)
  }

  const extension = normalized.slice(extensionIndex)
  const nameWithoutExtension = normalized.slice(0, extensionIndex)
  const maxBaseLength = MAX_FILE_NAME_LENGTH - extension.length

  return `${nameWithoutExtension.slice(0, maxBaseLength)}${extension}`
}

export function buildTaskIncidentPhotoStoragePath(input: {
  companyId: string
  incidentId: string
  photoId: string
  fileName: string
}): string {
  return `${input.companyId}/${input.incidentId}/${input.photoId}-${sanitizeTaskIncidentPhotoFileName(input.fileName)}`
}

export function validateTaskIncidentPhotoFile(file: File): string | null {
  if (
    !TASK_INCIDENT_PHOTO_MIME_TYPES.includes(
      file.type as (typeof TASK_INCIDENT_PHOTO_MIME_TYPES)[number]
    )
  ) {
    return "Formato no permitido. Use JPG, PNG o WEBP."
  }

  if (file.size > TASK_INCIDENT_PHOTO_MAX_SIZE_BYTES) {
    return "La imagen supera el tamaño máximo permitido."
  }

  return null
}

export function logTaskIncidentPhotoUploadFailed(input: {
  incidentId: string
  fileName: string
  storagePath?: string
  error: unknown
}) {
  console.error("[TASK_INCIDENT_PHOTO_UPLOAD_FAILED]", {
    incident_id: input.incidentId,
    file_name: input.fileName,
    storage_path: input.storagePath,
    error: input.error,
  })
}
