export type TaskPhotoType = "reference" | "evidence"

export type TaskPhoto = {
  id: string
  taskId: string
  photoType: TaskPhotoType
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
}
