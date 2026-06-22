import { createClient } from "@/lib/supabase/client"
import {
  fetchTaskReferencePhotos,
  uploadTaskReferencePhotos,
  type SupabaseTaskPhotosClient,
} from "@/lib/supabase/task-photos.queries"
import type { PendingTaskReferencePhoto } from "@/lib/types/task-photos"

export function createBrowserTaskPhotosClient(): SupabaseTaskPhotosClient {
  return createClient()
}

export async function listTaskReferencePhotos(taskId: string) {
  return fetchTaskReferencePhotos(createBrowserTaskPhotosClient(), taskId)
}

export async function uploadPendingTaskReferencePhotos(
  taskId: string,
  photos: PendingTaskReferencePhoto[]
) {
  const client = createBrowserTaskPhotosClient()
  const { data: authData } = await client.auth.getUser()
  const createdBy = authData.user?.id ?? null

  return uploadTaskReferencePhotos(
    client,
    taskId,
    photos.map((photo) => ({
      file: photo.file,
      description: photo.description,
    })),
    createdBy
  )
}
