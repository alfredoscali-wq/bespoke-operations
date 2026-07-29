import "server-only"

import {
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_STORAGE_BUCKET,
  isAttachmentAllowedMimeType,
  type AttachmentModule,
} from "@/lib/attachments/constants"
import { buildAttachmentStoragePath } from "@/lib/attachments/path"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  Attachment,
  AttachmentListFilters,
  AttachmentsRepositoryResult,
  UploadAttachmentInput,
} from "@/lib/types/attachments"

type AttachmentRow = {
  id: string
  company_id: string
  module: string
  record_id: string
  timeline_event_id: string | null
  original_name: string
  file_name: string
  mime_type: string
  file_size: number
  storage_path: string
  uploaded_by: string
  created_at: string
}

function mapAttachmentRow(
  row: AttachmentRow,
  uploadedByName: string | null = null
): Attachment {
  return {
    id: row.id,
    companyId: row.company_id,
    module: row.module as AttachmentModule,
    recordId: row.record_id,
    timelineEventId: row.timeline_event_id,
    originalName: row.original_name,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
    uploadedByName,
    createdAt: row.created_at,
  }
}

export function validateAttachmentFile(input: {
  originalName: string
  mimeType: string
  fileSize: number
}): { ok: true } | { ok: false; message: string } {
  if (!input.originalName.trim()) {
    return { ok: false, message: "El archivo no tiene nombre." }
  }

  if (!isAttachmentAllowedMimeType(input.mimeType)) {
    return {
      ok: false,
      message: `Tipo de archivo no permitido (${input.mimeType || "desconocido"}).`,
    }
  }

  if (input.fileSize <= 0 || input.fileSize > ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      message: `El archivo supera el tamaño máximo de ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB.`,
    }
  }

  return { ok: true }
}

async function assertCustomerAttentionRecord(input: {
  companyId: string
  recordId: string
}): Promise<AttachmentsRepositoryResult<true>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("customer_atenciones")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("id", input.recordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return {
      data: null,
      error: { code: "RECORD_LOOKUP_FAILED", message: error.message },
    }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "RECORD_NOT_FOUND",
        message: "No se encontró el registro asociado al adjunto.",
      },
    }
  }

  return { data: true, error: null }
}

async function assertCommercialTerritorialActivityRecord(input: {
  companyId: string
  recordId: string
}): Promise<AttachmentsRepositoryResult<true>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("commercial_territorial_activities" as never)
    .select("id")
    .eq("company_id", input.companyId)
    .eq("id", input.recordId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return {
      data: null,
      error: { code: "RECORD_LOOKUP_FAILED", message: error.message },
    }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "RECORD_NOT_FOUND",
        message: "No se encontró la actividad comercial asociada al adjunto.",
      },
    }
  }

  return { data: true, error: null }
}

export async function assertAttachmentRecordAccess(input: {
  companyId: string
  module: AttachmentModule
  recordId: string
}): Promise<AttachmentsRepositoryResult<true>> {
  switch (input.module) {
    case "customer_attention":
      return assertCustomerAttentionRecord(input)
    case "commercial":
      return assertCommercialTerritorialActivityRecord(input)
    default:
      return {
        data: null,
        error: {
          code: "MODULE_NOT_SUPPORTED",
          message: "Este módulo aún no admite adjuntos.",
        },
      }
  }
}

export async function uploadAttachment(
  input: UploadAttachmentInput
): Promise<AttachmentsRepositoryResult<Attachment>> {
  const validation = validateAttachmentFile({
    originalName: input.originalName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
  })
  if (!validation.ok) {
    return {
      data: null,
      error: { code: "VALIDATION", message: validation.message },
    }
  }

  const access = await assertAttachmentRecordAccess({
    companyId: input.companyId,
    module: input.module,
    recordId: input.recordId,
  })
  if (access.error || !access.data) {
    return { data: null, error: access.error }
  }

  const admin = createAdminClient()
  const storagePath = buildAttachmentStoragePath({
    companyId: input.companyId,
    module: input.module,
    recordId: input.recordId,
    fileName: input.originalName,
  })
  const fileName = storagePath.split("/").pop() ?? input.originalName

  const bytes =
    input.file instanceof Blob
      ? new Uint8Array(await input.file.arrayBuffer())
      : input.file

  const { error: uploadError } = await admin.storage
    .from(ATTACHMENTS_STORAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: input.mimeType,
      upsert: false,
    })

  if (uploadError) {
    return {
      data: null,
      error: {
        code: "STORAGE_UPLOAD_FAILED",
        message: uploadError.message || "No se pudo subir el archivo.",
      },
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("attachments")
    .insert({
      company_id: input.companyId,
      module: input.module,
      record_id: input.recordId,
      timeline_event_id: input.timelineEventId ?? null,
      original_name: input.originalName.trim(),
      file_name: fileName,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      storage_path: storagePath,
      uploaded_by: input.uploadedBy,
    })
    .select("*")
    .single()

  if (insertError || !inserted) {
    await admin.storage.from(ATTACHMENTS_STORAGE_BUCKET).remove([storagePath])
    return {
      data: null,
      error: {
        code: "METADATA_INSERT_FAILED",
        message: insertError?.message || "No se pudo registrar el adjunto.",
      },
    }
  }

  return {
    data: mapAttachmentRow(inserted as AttachmentRow),
    error: null,
  }
}

export async function listAttachments(
  filters: AttachmentListFilters
): Promise<AttachmentsRepositoryResult<Attachment[]>> {
  const admin = createAdminClient()
  let query = admin
    .from("attachments")
    .select("*")
    .eq("company_id", filters.companyId)
    .eq("module", filters.module)
    .eq("record_id", filters.recordId)
    .order("created_at", { ascending: true })

  if (filters.timelineEventId) {
    query = query.eq("timeline_event_id", filters.timelineEventId)
  }

  const { data, error } = await query

  if (error) {
    return {
      data: null,
      error: { code: "LIST_FAILED", message: error.message },
    }
  }

  const rows = (data ?? []) as AttachmentRow[]
  const uploaderIds = [...new Set(rows.map((row) => row.uploaded_by))]
  const nameById = new Map<string, string>()

  if (uploaderIds.length > 0) {
    const { data: employees } = await admin
      .from("employees")
      .select("id, first_name, last_name, preferred_name")
      .eq("company_id", filters.companyId)
      .in("id", uploaderIds)

    for (const employee of employees ?? []) {
      const display =
        employee.preferred_name?.trim() ||
        `${employee.first_name} ${employee.last_name}`.trim()
      nameById.set(employee.id, display || "Empleado")
    }
  }

  return {
    data: rows.map((row) =>
      mapAttachmentRow(row, nameById.get(row.uploaded_by) ?? null)
    ),
    error: null,
  }
}

export async function getAttachment(input: {
  companyId: string
  attachmentId: string
}): Promise<AttachmentsRepositoryResult<Attachment>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("attachments")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("id", input.attachmentId)
    .maybeSingle()

  if (error) {
    return {
      data: null,
      error: { code: "GET_FAILED", message: error.message },
    }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Adjunto no encontrado." },
    }
  }

  return {
    data: mapAttachmentRow(data as AttachmentRow),
    error: null,
  }
}

export async function getAttachmentPreviewUrl(input: {
  companyId: string
  attachmentId: string
  expiresInSeconds?: number
}): Promise<AttachmentsRepositoryResult<{ url: string; attachment: Attachment }>> {
  const attachmentResult = await getAttachment({
    companyId: input.companyId,
    attachmentId: input.attachmentId,
  })

  if (attachmentResult.error || !attachmentResult.data) {
    return { data: null, error: attachmentResult.error }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(ATTACHMENTS_STORAGE_BUCKET)
    .createSignedUrl(
      attachmentResult.data.storagePath,
      input.expiresInSeconds ?? 60 * 10
    )

  if (error || !data?.signedUrl) {
    return {
      data: null,
      error: {
        code: "SIGNED_URL_FAILED",
        message: error?.message || "No se pudo generar el enlace del archivo.",
      },
    }
  }

  return {
    data: {
      url: data.signedUrl,
      attachment: attachmentResult.data,
    },
    error: null,
  }
}

export async function deleteAttachment(input: {
  companyId: string
  attachmentId: string
}): Promise<AttachmentsRepositoryResult<{ id: string }>> {
  const attachmentResult = await getAttachment(input)
  if (attachmentResult.error || !attachmentResult.data) {
    return { data: null, error: attachmentResult.error }
  }

  const admin = createAdminClient()
  const { error: deleteMetaError } = await admin
    .from("attachments")
    .delete()
    .eq("company_id", input.companyId)
    .eq("id", input.attachmentId)

  if (deleteMetaError) {
    return {
      data: null,
      error: {
        code: "DELETE_FAILED",
        message: deleteMetaError.message,
      },
    }
  }

  await admin.storage
    .from(ATTACHMENTS_STORAGE_BUCKET)
    .remove([attachmentResult.data.storagePath])

  return { data: { id: input.attachmentId }, error: null }
}

export { ATTACHMENT_ALLOWED_MIME_TYPES, ATTACHMENT_MAX_BYTES }
