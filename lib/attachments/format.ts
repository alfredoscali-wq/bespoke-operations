export function formatAttachmentFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—"
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export type AttachmentPreviewKind = "image" | "pdf" | "audio" | "video" | "file"

export function resolveAttachmentPreviewKind(
  mimeType: string
): AttachmentPreviewKind {
  if (mimeType.startsWith("image/")) {
    return "image"
  }
  if (mimeType === "application/pdf") {
    return "pdf"
  }
  if (mimeType.startsWith("audio/")) {
    return "audio"
  }
  if (mimeType.startsWith("video/")) {
    return "video"
  }
  return "file"
}

export function resolveAttachmentTypeEmoji(mimeType: string): string {
  switch (resolveAttachmentPreviewKind(mimeType)) {
    case "image":
      return "📷"
    case "pdf":
      return "📄"
    case "audio":
      return "🎧"
    case "video":
      return "🎬"
    default:
      return "📎"
  }
}
