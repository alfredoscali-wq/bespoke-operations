import type {
  EvidenceCategoryType,
  EvidenceComment,
  EvidenceFileType,
  EvidenceRecord,
  EvidenceStatus,
  EvidenceUploadEvent,
} from "@/lib/types/evidence"

export type CreateEvidencePayload = Omit<
  EvidenceRecord,
  "id" | "previewUrl" | "uploadHistory"
> & {
  projectId?: string | null
  taskId?: string | null
  storagePath?: string | null
  mimeType?: string | null
  fileSizeBytes?: number | null
  previewUrl?: string | null
  uploadHistory?: EvidenceUploadEvent[]
}

export type UpdateEvidencePayload = Partial<{
  fileName: string
  fileType: EvidenceFileType
  evidenceType: EvidenceCategoryType
  storagePath: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  previewUrl: string | null
  projectId: string | null
  projectCode: string
  projectName: string
  taskId: string | null
  taskCode: string
  taskTitle: string
  crew: string
  worker: string
  uploadedAt: string
  status: EvidenceStatus
  description: string
  category: string
  comments: EvidenceComment[]
  uploadHistory: EvidenceUploadEvent[]
}>

export type EvidencesRepositoryErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "STORAGE"
  | "UNKNOWN"

export type EvidencesRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: EvidencesRepositoryErrorCode
        message: string
      }
    }
