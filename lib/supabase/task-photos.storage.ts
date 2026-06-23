export const TASK_PHOTOS_STORAGE_BUCKET = "task-photos"

export const TASK_REFERENCE_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const

export const TASK_REFERENCE_PHOTO_MAX_SIZE_BYTES = 52428800

const MAX_FILE_NAME_LENGTH = 180

export function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
}

export function sanitizeTaskPhotoFileName(fileName: string): string {
  const trimmed = fileName.trim()
  const baseName = trimmed.replace(/^-+|-+$/g, "") || "photo"
  const normalized = sanitizeFileName(baseName)
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

export function buildTaskPhotoStoragePath(input: {
  taskId: string
  photoId: string
  fileName: string
}): string {
  return `${input.taskId}/${input.photoId}-${sanitizeTaskPhotoFileName(input.fileName)}`
}

export function validateTaskReferencePhotoFile(file: File): string | null {
  if (
    !TASK_REFERENCE_PHOTO_MIME_TYPES.includes(
      file.type as (typeof TASK_REFERENCE_PHOTO_MIME_TYPES)[number]
    )
  ) {
    return "Formato no permitido. Use JPG, PNG o WEBP."
  }

  if (file.size > TASK_REFERENCE_PHOTO_MAX_SIZE_BYTES) {
    return "La imagen supera el tamaño máximo permitido."
  }

  return null
}

export function logTaskPhotoUploadFailed(input: {
  taskId: string
  fileName: string
  storagePath?: string
  error: unknown
}) {
  console.error("[TASK_PHOTO_UPLOAD_FAILED]", {
    task_id: input.taskId,
    file_name: input.fileName,
    storage_path: input.storagePath,
    error: input.error,
  })
}
