export const EVIDENCES_STORAGE_BUCKET = "evidences"

const MAX_FILE_NAME_LENGTH = 180

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
