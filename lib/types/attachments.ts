import type { AttachmentModule } from "@/lib/attachments/constants"

export type Attachment = {
  id: string
  companyId: string
  module: AttachmentModule
  recordId: string
  timelineEventId: string | null
  originalName: string
  fileName: string
  mimeType: string
  fileSize: number
  storagePath: string
  uploadedBy: string
  uploadedByName: string | null
  createdAt: string
}

export type AttachmentListFilters = {
  companyId: string
  module: AttachmentModule
  recordId: string
  timelineEventId?: string | null
}

export type UploadAttachmentInput = {
  companyId: string
  module: AttachmentModule
  recordId: string
  timelineEventId?: string | null
  uploadedBy: string
  file: File | Blob
  originalName: string
  mimeType: string
  fileSize: number
}

export type AttachmentsRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } }
