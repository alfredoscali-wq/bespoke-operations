export type TaskPhotoType = "reference" | "evidence"

export type TaskPhoto = {
  id: string
  taskId: string
  photoType: TaskPhotoType
  operationalStepId?: string | null
  fileUrl: string
  fileName: string
  description: string
  createdAt: string
  createdBy?: string | null
  signedUrl?: string
}

export type PendingTaskReferencePhoto = {
  clientId: string
  file: File
  previewUrl: string
  description: string
}

export type UploadTaskReferencePhotoInput = {
  taskId: string
  file: File
  description?: string
  createdBy?: string | null
  operationalStepId?: string | null
}

export type TaskPhotoUploadFailure = {
  fileName: string
  storagePath?: string
  message: string
}

export type TaskPhotoUploadBatchResult = {
  uploaded: TaskPhoto[]
  failures: TaskPhotoUploadFailure[]
}

export type TaskPhotoUploadSummary = {
  taskCreated: boolean
  uploadedPhotos: number
  failedPhotos: number
}

export function toTaskPhotoUploadSummary(
  batch: TaskPhotoUploadBatchResult,
  taskCreated = true
): TaskPhotoUploadSummary {
  return {
    taskCreated,
    uploadedPhotos: batch.uploaded.length,
    failedPhotos: batch.failures.length,
  }
}
