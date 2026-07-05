import { createClient } from "@/lib/supabase/client"
import {
  countTaskEvidencePhotos,
  fetchAllTaskPhotos,
  fetchTaskEvidencePhotos,
  fetchTaskReferencePhotos,
  uploadOperationalStepPhoto as uploadOperationalStepPhotoQuery,
  uploadTaskEvidencePhoto,
  uploadTaskReferencePhoto,
  uploadTaskReferencePhotos,
  type SupabaseTaskPhotosClient,
} from "@/lib/supabase/task-photos.queries"
import { buildStepPhotoCounts } from "@/lib/operational-steps/utils"
import type {
  PendingTaskReferencePhoto,
  TaskPhotoUploadBatchResult,
  TaskPhotoUploadSummary,
} from "@/lib/types/task-photos"
import { toTaskPhotoUploadSummary } from "@/lib/types/task-photos"

export function createBrowserTaskPhotosClient(): SupabaseTaskPhotosClient {
  return createClient()
}

async function getCreatedBy(client: SupabaseTaskPhotosClient) {
  const { data: authData } = await client.auth.getUser()
  return authData.user?.id ?? null
}

export async function listTaskReferencePhotos(taskId: string) {
  return fetchTaskReferencePhotos(createBrowserTaskPhotosClient(), taskId)
}

export async function listTaskEvidencePhotos(taskId: string) {
  return fetchTaskEvidencePhotos(createBrowserTaskPhotosClient(), taskId)
}

export async function listAllTaskPhotos(taskId: string) {
  return fetchAllTaskPhotos(createBrowserTaskPhotosClient(), taskId)
}

export async function getTaskEvidencePhotoCount(taskId: string) {
  return countTaskEvidencePhotos(createBrowserTaskPhotosClient(), taskId)
}

export async function getOperationalStepPhotoCounts(taskId: string) {
  const result = await listTaskEvidencePhotos(taskId)
  if (result.error) {
    return { data: null, error: result.error }
  }

  return {
    data: buildStepPhotoCounts(result.data ?? []),
    error: null,
  }
}

export type PendingReferencePhotoUploadResult = {
  batch: TaskPhotoUploadBatchResult
  summary: TaskPhotoUploadSummary
}

export async function uploadPendingTaskReferencePhotos(
  taskId: string,
  photos: PendingTaskReferencePhoto[]
): Promise<PendingReferencePhotoUploadResult> {
  const client = createBrowserTaskPhotosClient()
  const createdBy = await getCreatedBy(client)

  const result = await uploadTaskReferencePhotos(
    client,
    taskId,
    photos.map((photo) => ({
      file: photo.file,
      description: photo.description,
    })),
    createdBy
  )

  const batch = result.data ?? { uploaded: [], failures: [] }

  return {
    batch,
    summary: toTaskPhotoUploadSummary(batch, true),
  }
}

export async function uploadTaskReferencePhotoFiles(input: {
  taskId: string
  photos: Array<{ file: File; description?: string }>
}): Promise<PendingReferencePhotoUploadResult> {
  const client = createBrowserTaskPhotosClient()
  const createdBy = await getCreatedBy(client)
  const result = await uploadTaskReferencePhotos(
    client,
    input.taskId,
    input.photos,
    createdBy
  )

  const batch = result.data ?? { uploaded: [], failures: [] }

  return {
    batch,
    summary: toTaskPhotoUploadSummary(batch, true),
  }
}

export async function uploadTaskEvidencePhotoFile(input: {
  taskId: string
  file: File
  description?: string
}) {
  const client = createBrowserTaskPhotosClient()
  const createdBy = await getCreatedBy(client)

  return uploadTaskEvidencePhoto(client, {
    taskId: input.taskId,
    file: input.file,
    description: input.description,
    createdBy,
  })
}

export async function uploadTaskReferencePhotoFile(input: {
  taskId: string
  file: File
  description?: string
}) {
  const client = createBrowserTaskPhotosClient()
  const createdBy = await getCreatedBy(client)

  return uploadTaskReferencePhoto(client, {
    taskId: input.taskId,
    file: input.file,
    description: input.description,
    createdBy,
  })
}

export async function uploadOperationalStepPhoto(input: {
  taskId: string
  operationalStepId: string
  file: File
  description?: string
}) {
  const client = createBrowserTaskPhotosClient()
  const createdBy = await getCreatedBy(client)

  return uploadOperationalStepPhotoQuery(client, {
    taskId: input.taskId,
    operationalStepId: input.operationalStepId,
    file: input.file,
    description: input.description,
    createdBy,
  })
}
