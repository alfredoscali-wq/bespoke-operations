export const EVIDENCES_STORAGE_BUCKET = "evidences"

export const EVIDENCE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
] as const

export const EVIDENCE_MAX_FILE_SIZE_BYTES = 52428800

const MAX_FILE_NAME_LENGTH = 180

export function getStorageSegmentProjectId(
  projectId: string | null | undefined,
  projectCode: string
): string {
  return projectId || `code:${projectCode}`
}

export function getStorageSegmentTaskId(
  taskId: string | null | undefined,
  taskCode?: string
): string {
  return taskId || `code:${taskCode?.trim() || "OBRA"}`
}

export type EvidenceStoragePathInput = {
  projectId: string
  taskId: string
  evidenceId: string
  fileName: string
}

export function sanitizeEvidenceFileName(fileName: string): string {
  const trimmed = fileName.trim()
  const normalized = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_")

  if (normalized.length <= MAX_FILE_NAME_LENGTH) {
    return normalized
  }

  const extensionIndex = normalized.lastIndexOf(".")
  if (extensionIndex <= 0) {
    return normalized.slice(0, MAX_FILE_NAME_LENGTH)
  }

  const extension = normalized.slice(extensionIndex)
  const base = normalized.slice(0, MAX_FILE_NAME_LENGTH - extension.length)
  return `${base}${extension}`
}

export function buildEvidenceStoragePath(input: EvidenceStoragePathInput): string {
  return [
    input.projectId,
    input.taskId,
    input.evidenceId,
    sanitizeEvidenceFileName(input.fileName),
  ].join("/")
}

export function parseEvidenceStoragePath(storagePath: string) {
  const segments = storagePath.split("/").filter(Boolean)

  if (segments.length < 4) {
    return null
  }

  const [projectId, taskId, evidenceId, ...fileNameParts] = segments

  return {
    projectId,
    taskId,
    evidenceId,
    fileName: fileNameParts.join("/"),
  }
}
