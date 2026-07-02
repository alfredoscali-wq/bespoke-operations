import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TaskPhotoRow } from "@/lib/supabase/database.types"
import { mapTaskPhotoRowToTaskPhoto } from "@/lib/supabase/task-photos.mapper"
import {
  TASK_PHOTOS_STORAGE_BUCKET,
  buildTaskPhotoStoragePath,
  logTaskPhotoUploadFailed,
  sanitizeTaskPhotoFileName,
  validateTaskReferencePhotoFile,
} from "@/lib/supabase/task-photos.storage"
import type {
  TaskPhoto,
  TaskPhotoType,
  TaskPhotoUploadBatchResult,
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
  if (error.code === "22P02") {
    return {
      code: "VALIDATION" as const,
      message: "Datos de la fotografía inválidos.",
    }
  }

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

export async function fetchTaskPhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string,
  photoType: TaskPhotoType
): Promise<TaskPhotosRepositoryResult<TaskPhoto[]>> {
  const { data, error } = await client
    .from("task_photos")
    .select("*")
    .eq("task_id", taskId)
    .eq("photo_type", photoType)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  const photos = await mapRowsWithSignedUrls(client, data ?? [])
  return { data: photos, error: null }
}

export async function fetchTaskReferencePhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string
): Promise<TaskPhotosRepositoryResult<TaskPhoto[]>> {
  return fetchTaskPhotos(client, taskId, "reference")
}

export async function fetchTaskEvidencePhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string
): Promise<TaskPhotosRepositoryResult<TaskPhoto[]>> {
  return fetchTaskPhotos(client, taskId, "evidence")
}

export async function uploadTaskPhoto(
  client: SupabaseTaskPhotosClient,
  input: UploadTaskReferencePhotoInput,
  photoType: TaskPhotoType
): Promise<TaskPhotosRepositoryResult<TaskPhoto>> {
  const validationMessage = validateTaskReferencePhotoFile(input.file)
  if (validationMessage) {
    return {
      data: null,
      error: { code: "VALIDATION", message: validationMessage },
    }
  }

  const photoId = crypto.randomUUID()
  const sanitizedFileName = sanitizeTaskPhotoFileName(input.file.name)
  const storagePath = buildTaskPhotoStoragePath({
    taskId: input.taskId,
    photoId,
    fileName: sanitizedFileName,
  })

  const { error: uploadError } = await client.storage
    .from(TASK_PHOTOS_STORAGE_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: input.file.type,
    })

  if (uploadError) {
    logTaskPhotoUploadFailed({
      taskId: input.taskId,
      fileName: input.file.name,
      storagePath,
      error: uploadError,
    })

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
      file_name: sanitizedFileName,
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
      caption: description,
      description,
      photo_type: photoType,
      operational_step_id:
        photoType === "evidence" ? input.operationalStepId ?? null : null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("ERROR REAL SUPABASE:", error)
    await client.storage.from(TASK_PHOTOS_STORAGE_BUCKET).remove([storagePath])
    logTaskPhotoUploadFailed({
      taskId: input.taskId,
      fileName: input.file.name,
      storagePath,
      error: error ?? { message: "No se pudo registrar la foto." },
    })
    

    return {
      data: null,
      error: mapSupabaseError(error ?? { message: "No se pudo registrar la foto." }),
    }
  }

  const [photo] = await mapRowsWithSignedUrls(client, [data])
  return { data: photo, error: null }
}

export async function uploadTaskReferencePhoto(
  client: SupabaseTaskPhotosClient,
  input: UploadTaskReferencePhotoInput
): Promise<TaskPhotosRepositoryResult<TaskPhoto>> {
  return uploadTaskPhoto(client, input, "reference")
}

export async function uploadTaskEvidencePhoto(
  client: SupabaseTaskPhotosClient,
  input: UploadTaskReferencePhotoInput
): Promise<TaskPhotosRepositoryResult<TaskPhoto>> {
  return uploadTaskPhoto(client, input, "evidence")
}

export async function uploadOperationalStepPhoto(
  client: SupabaseTaskPhotosClient,
  input: UploadTaskReferencePhotoInput & { operationalStepId: string }
): Promise<TaskPhotosRepositoryResult<TaskPhoto>> {
  if (!input.operationalStepId.trim()) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "Debe indicar el paso operativo.",
      },
    }
  }

  return uploadTaskPhoto(
    client,
    {
      ...input,
      operationalStepId: input.operationalStepId,
    },
    "evidence"
  )
}

export async function uploadTaskPhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string,
  photos: Array<{ file: File; description?: string }>,
  photoType: TaskPhotoType,
  createdBy?: string | null
): Promise<TaskPhotosRepositoryResult<TaskPhotoUploadBatchResult>> {
  const uploaded: TaskPhoto[] = []
  const failures: TaskPhotoUploadBatchResult["failures"] = []

  for (const photo of photos) {
    const sanitizedFileName = sanitizeTaskPhotoFileName(photo.file.name)
    const previewStoragePath = buildTaskPhotoStoragePath({
      taskId,
      photoId: crypto.randomUUID(),
      fileName: sanitizedFileName,
    })

    const result = await uploadTaskPhoto(
      client,
      {
        taskId,
        file: photo.file,
        description: photo.description,
        createdBy,
      },
      photoType
    )

    if (result.error || !result.data) {
      failures.push({
        fileName: photo.file.name,
        storagePath: previewStoragePath,
        message: result.error?.message ?? "No se pudo subir la foto.",
      })
      continue
    }

    uploaded.push(result.data)
  }

  return {
    data: {
      uploaded,
      failures,
    },
    error: null,
  }
}

export async function uploadTaskReferencePhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string,
  photos: Array<{ file: File; description?: string }>,
  createdBy?: string | null
): Promise<TaskPhotosRepositoryResult<TaskPhotoUploadBatchResult>> {
  return uploadTaskPhotos(client, taskId, photos, "reference", createdBy)
}

export async function uploadTaskEvidencePhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string,
  photos: Array<{ file: File; description?: string }>,
  createdBy?: string | null
): Promise<TaskPhotosRepositoryResult<TaskPhotoUploadBatchResult>> {
  return uploadTaskPhotos(client, taskId, photos, "evidence", createdBy)
}

export async function countTaskEvidencePhotos(
  client: SupabaseTaskPhotosClient,
  taskId: string
): Promise<TaskPhotosRepositoryResult<number>> {
  const { count, error } = await client
    .from("task_photos")
    .select("*", { count: "exact", head: true })
    .eq("task_id", taskId)
    .eq("photo_type", "evidence")
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  return { data: count ?? 0, error: null }
}
