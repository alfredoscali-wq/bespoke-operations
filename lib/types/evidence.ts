import type { AppUserRole } from "@/lib/auth/current-user"

export type EvidenceStatus = "pending-review" | "approved" | "rejected"

export type EvidenceFileType = "photo" | "pdf" | "plan" | "video"

export type EvidenceCategoryType =
  | "initial-photo"
  | "progress-photo"
  | "final-photo"
  | "otdr-certification"
  | "plan"
  | "client-document"

export type EvidenceComment = {
  id: string
  author: string
  role: "supervisor" | "operario" | "coordinador"
  content: string
  timestamp: string
}

export type EvidenceUploadEvent = {
  id: string
  action: string
  user: string
  timestamp: string
  note?: string
  role?: AppUserRole
}

export type EvidenceRecord = {
  id: string
  fileName: string
  type: EvidenceFileType
  evidenceType: EvidenceCategoryType
  previewUrl: string
  projectId: string
  projectCode: string
  projectName: string
  taskId: string
  taskCode: string
  taskTitle: string
  crew: string
  worker: string
  uploadedByRole?: AppUserRole
  deletedAt?: string | null
  uploadedAt: string
  status: EvidenceStatus
  description: string
  category: string
  comments: EvidenceComment[]
  uploadHistory: EvidenceUploadEvent[]
}

export type EvidenceFilters = {
  search: string
  projectId: string | "all"
  taskId: string | "all"
  crew: string | "all"
  worker: string | "all"
  dateFrom: string
  dateTo: string
  fileType: EvidenceFileType | "document" | "all"
  evidenceType: EvidenceCategoryType | "all"
  includeVoided: boolean
}

export type EvidenceSummary = {
  total: number
  photos: number
  documents: number
  pendingReview: number
}

export type ProjectEvidenceStats = {
  totalPhotos: number
  totalDocuments: number
  lastUploadedAt: string | null
}

export type TaskEvidenceStats = {
  count: number
  lastUploadedAt: string | null
}

export type EvidenceNavigation = {
  prevId: string | null
  nextId: string | null
  currentIndex: number
  totalInTask: number
}
