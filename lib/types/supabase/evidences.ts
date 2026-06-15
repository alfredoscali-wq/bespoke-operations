import type {
  EvidenceCategoryType,
  EvidenceComment,
  EvidenceFileType,
  EvidenceRecord,
  EvidenceStatus,
  EvidenceUploadEvent,
} from "@/lib/types/evidence"
import type { AppUserRole } from "@/lib/auth/current-user"
import type { EvidenceUploadOrigin } from "@/lib/evidence/upload-origin"

export type CreateEvidencePayload = Omit<
  EvidenceRecord,
  "id" | "previewUrl" | "uploadHistory" | "projectId" | "taskId"
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
  deletedAt?: string | null
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

export type UploadEvidenceInput = {
  file: File
  projectId?: string | null
  projectCode: string
  projectName: string
  taskId?: string | null
  taskCode?: string
  taskTitle?: string
  crew?: string
  /** Legacy field name — persisted as evidences.worker (uploadedBy). */
  worker?: string
  uploadedByRole?: AppUserRole
  description?: string
  category?: string
  evidenceType?: EvidenceCategoryType
  origin?: EvidenceUploadOrigin
}

export type UploadEvidenceResult = {
  success: boolean
  data?: EvidenceRecord
  message?: string
}
