import { PREVIEW_IMAGES } from "@/lib/evidence/constants"
import type {
  EvidenceInsert,
  EvidenceRow,
  EvidenceUpdate,
} from "@/lib/supabase/database.types"
import type {
  EvidenceComment,
  EvidenceRecord,
  EvidenceUploadEvent,
} from "@/lib/types/evidence"
import type {
  CreateEvidencePayload,
  UpdateEvidencePayload,
} from "@/lib/types/supabase/evidences"

function parseComments(value: unknown): EvidenceComment[] {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is EvidenceComment =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as EvidenceComment).id === "string" &&
      typeof (item as EvidenceComment).author === "string" &&
      typeof (item as EvidenceComment).role === "string" &&
      typeof (item as EvidenceComment).content === "string" &&
      typeof (item as EvidenceComment).timestamp === "string"
  )
}

function parseUploadHistory(value: unknown): EvidenceUploadEvent[] {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is EvidenceUploadEvent =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as EvidenceUploadEvent).id === "string" &&
      typeof (item as EvidenceUploadEvent).action === "string" &&
      typeof (item as EvidenceUploadEvent).user === "string" &&
      typeof (item as EvidenceUploadEvent).timestamp === "string"
  )
}

function resolvePreviewUrl(row: EvidenceRow): string {
  if (row.preview_url) return row.preview_url
  if (row.file_type === "photo") return PREVIEW_IMAGES.fiber
  if (row.file_type === "video") return PREVIEW_IMAGES.video
  if (row.file_type === "plan") return PREVIEW_IMAGES.plan
  return PREVIEW_IMAGES.document
}

export function mapEvidenceRowToRecord(row: EvidenceRow): EvidenceRecord {
  return {
    id: row.id,
    fileName: row.file_name,
    type: row.file_type,
    evidenceType: row.evidence_type,
    previewUrl: resolvePreviewUrl(row),
    projectId: row.project_id ?? "",
    projectCode: row.project_code,
    projectName: row.project_name,
    taskId: row.task_id ?? "",
    taskCode: row.task_code,
    taskTitle: row.task_title,
    crew: row.crew,
    worker: row.worker,
    uploadedAt: row.uploaded_at,
    status: row.status,
    description: row.description,
    category: row.category,
    comments: parseComments(row.comments),
    uploadHistory: parseUploadHistory(row.upload_history),
  }
}

export function mapCreatePayloadToInsert(
  payload: CreateEvidencePayload
): EvidenceInsert {
  return {
    file_name: payload.fileName.trim(),
    file_type: payload.type,
    evidence_type: payload.evidenceType,
    storage_path: payload.storagePath ?? null,
    mime_type: payload.mimeType ?? null,
    file_size_bytes: payload.fileSizeBytes ?? null,
    preview_url: payload.previewUrl ?? null,
    project_id: payload.projectId ?? null,
    project_code: payload.projectCode.trim(),
    project_name: payload.projectName.trim(),
    task_id: payload.taskId ?? null,
    task_code: payload.taskCode.trim(),
    task_title: payload.taskTitle.trim(),
    crew: payload.crew.trim(),
    worker: payload.worker.trim(),
    uploaded_at: payload.uploadedAt,
    status: payload.status ?? "pending-review",
    description: payload.description.trim(),
    category: payload.category.trim(),
    comments: payload.comments,
    upload_history: payload.uploadHistory ?? [],
  }
}

export function mapUpdatePayloadToUpdate(
  payload: UpdateEvidencePayload
): EvidenceUpdate {
  const update: EvidenceUpdate = {}

  if (payload.fileName !== undefined) update.file_name = payload.fileName.trim()
  if (payload.fileType !== undefined) update.file_type = payload.fileType
  if (payload.evidenceType !== undefined) {
    update.evidence_type = payload.evidenceType
  }
  if (payload.storagePath !== undefined) {
    update.storage_path = payload.storagePath
  }
  if (payload.mimeType !== undefined) update.mime_type = payload.mimeType
  if (payload.fileSizeBytes !== undefined) {
    update.file_size_bytes = payload.fileSizeBytes
  }
  if (payload.previewUrl !== undefined) update.preview_url = payload.previewUrl
  if (payload.projectId !== undefined) update.project_id = payload.projectId
  if (payload.projectCode !== undefined) {
    update.project_code = payload.projectCode.trim()
  }
  if (payload.projectName !== undefined) {
    update.project_name = payload.projectName.trim()
  }
  if (payload.taskId !== undefined) update.task_id = payload.taskId
  if (payload.taskCode !== undefined) update.task_code = payload.taskCode.trim()
  if (payload.taskTitle !== undefined) {
    update.task_title = payload.taskTitle.trim()
  }
  if (payload.crew !== undefined) update.crew = payload.crew.trim()
  if (payload.worker !== undefined) update.worker = payload.worker.trim()
  if (payload.uploadedAt !== undefined) update.uploaded_at = payload.uploadedAt
  if (payload.status !== undefined) update.status = payload.status
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.category !== undefined) update.category = payload.category.trim()
  if (payload.comments !== undefined) update.comments = payload.comments
  if (payload.uploadHistory !== undefined) {
    update.upload_history = payload.uploadHistory
  }

  return update
}

export function mapEvidenceRecordToUpdatePayload(
  record: EvidenceRecord
): UpdateEvidencePayload {
  return {
    status: record.status,
    comments: record.comments,
    uploadHistory: record.uploadHistory,
  }
}
