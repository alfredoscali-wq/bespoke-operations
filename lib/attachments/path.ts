import type { AttachmentModule } from "@/lib/attachments/constants"

export function sanitizeAttachmentFileName(fileName: string): string {
  const trimmed = fileName.trim()
  const normalized = trimmed
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
  return normalized.slice(0, 180) || "archivo"
}

/**
 * Builds storage object path:
 * {companyId}/{module}/{recordId}/{uniqueFileName}
 */
export function buildAttachmentStoragePath(input: {
  companyId: string
  module: AttachmentModule
  recordId: string
  fileName: string
}): string {
  const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const safeName = sanitizeAttachmentFileName(input.fileName)

  return [
    input.companyId,
    input.module,
    input.recordId,
    `${uniquePrefix}-${safeName}`,
  ].join("/")
}
