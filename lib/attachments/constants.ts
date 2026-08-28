export const ATTACHMENTS_STORAGE_BUCKET = "attachments"

export const ATTACHMENT_MODULES = [
  "customer_attention",
  "commercial",
  "projects",
  "tasks",
  "employees",
  "customers",
  "materials",
] as const

export type AttachmentModule = (typeof ATTACHMENT_MODULES)[number]

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const

export type AttachmentAllowedMimeType =
  (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number]

export function isAttachmentModule(value: string): value is AttachmentModule {
  return (ATTACHMENT_MODULES as readonly string[]).includes(value)
}

export function isAttachmentAllowedMimeType(
  value: string
): value is AttachmentAllowedMimeType {
  return (ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(value)
}
