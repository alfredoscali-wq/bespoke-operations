import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TaskPhotoRow } from "@/lib/supabase/database.types"
import { mapTaskPhotoRowToTaskPhoto } from "@/lib/supabase/task-photos.mapper"
import {
  TASK_PHOTOS_STORAGE_BUCKET,
  buildTaskPhotoStoragePath,
  validateTaskReferencePhotoFile,
} from "@/lib/supabase/task-photos.storage"
import type {
  TaskPhoto,
  UploadTaskReferencePhotoInput,
} from "@/lib/types/task-photos"

export type SupabaseTaskPhotosClient = SupabaseClient<Database>

export type TaskPhotosRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: "NOT_FOUND" | "VALIDATION" | "UPLOAD" | "UNKNOWN"
        message: string
      }
    }

const SIGNED_URL_TTL_SECONDS = 3600

function mapSupabaseError(error: { message?: string; code?: string }) {
  return {
    code: "UNKNOWN" as const,
    message: error.message ?? "No fue posible completar la operación.",
  }
}

async function mapRowsWithSignedUrls(
  client: SupabaseTaskPhotosClient,
  rows: TaskPhotoRow[]
): Promise<TaskPhoto[]> {
  if (rows.length === 0) return []

  const pathsToSign = rows
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path))

  const signedUrlMap = new Map<string, string>()

  if (pathsToSign.length > 0) {
    const { data, error } = await client.storage
      .from(TASK_PHOTOS_STORAGE_BUCKET)
      .createSignedUrls(pathsToSign, SIGNED_URL_TTL_SECONDS)

    if (!error && data) {
      data.forEach((item) => {
        if (item.path && item.signedUrl && !item.error) {
          signedUrlMap.set(item.path, item.signedUrl)
        }
      })
    }
  }

  return rows.map((row) =>
    mapTaskPhotoRowToTaskPhoto(row, signedUrlMap.get(row.storage_path))
  )
}

export async function fetchTaskReferencePhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string
): Promise<TaskPhotosRepositoryResult<TaskPhoto[]>> {
  const { data, error } = await client
    .from("task_photos")
    .select("*")
    .eq("task_id", taskId)
    .eq("photo_type", "reference")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  const photos = await mapRowsWithSignedUrls(client, data ?? [])
  return { data: photos, error: null }
}

export async function uploadTaskReferencePhoto(
  client: SupabaseTaskPhotosClient,
  input: UploadTaskReferencePhotoInput
): Promise<TaskPhotosRepositoryResult<TaskPhoto>> {
  const validationMessage = validateTaskReferencePhotoFile(input.file)
  if (validationMessage) {
    return {
      data: null,
      error: { code: "VALIDATION", message: validationMessage },
    }
  }

  const photoId = crypto.randomUUID()
  const storagePath = buildTaskPhotoStoragePath({
    taskId: input.taskId,
    photoId,
    fileName: input.file.name,
  })

  const { error: uploadError } = await client.storage
    .from(TASK_PHOTOS_STORAGE_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: input.file.type,
    })

  if (uploadError) {
    return {
      data: null,
      error: {
        code: "UPLOAD",
        message: uploadError.message ?? "No se pudo subir la foto.",
      },
    }
  }

  const description = input.description?.trim() ?? ""
  const { data, error } = await client
    .from("task_photos")
    .insert({
      id: photoId,
      task_id: input.taskId,
      storage_bucket: TASK_PHOTOS_STORAGE_BUCKET,
      storage_path: storagePath,
      file_url: storagePath,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
      caption: description,
      description,
      photo_type: "reference",
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    await client.storage.from(TASK_PHOTOS_STORAGE_BUCKET).remove([storagePath])
    return {
      data: null,
      error: mapSupabaseError(error ?? { message: "No se pudo registrar la foto." }),
    }
  }

  const [photo] = await mapRowsWithSignedUrls(client, [data])
  return { data: photo, error: null }
}

export async function uploadTaskReferencePhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string,
  photos: Array<{ file: File; description?: string }>,
  createdBy?: string | null
): Promise<TaskPhotosRepositoryResult<TaskPhoto[]>> {
  const uploaded: TaskPhoto[] = []

  for (const photo of photos) {
    const result = await uploadTaskReferencePhoto(client, {
      taskId,
      file: photo.file,
      description: photo.description,
      createdBy,
    })

    if (result.error || !result.data) {
      return result.error
        ? { data: null, error: result.error }
        : {
            data: null,
            error: {
              code: "UPLOAD",
              message: "No se pudieron cargar todas las fotos.",
            },
          }
    }

    uploaded.push(result.data)
  }

  return { data: uploaded, error: null }
}
