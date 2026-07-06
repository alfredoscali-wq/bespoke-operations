import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { insertTaskIncidentPhoto } from "@/lib/supabase/task-incidents.queries"
import {
  buildTaskIncidentPhotoStoragePath,
  logTaskIncidentPhotoUploadFailed,
  sanitizeTaskIncidentPhotoFileName,
  TASK_INCIDENT_PHOTOS_STORAGE_BUCKET,
  validateTaskIncidentPhotoFile,
} from "@/lib/supabase/task-incident-photos.storage"
import type { TaskIncidentPhoto } from "@/lib/types/task-incidents"
import type { TaskIncidentsRepositoryResult } from "@/lib/types/supabase/task-incidents"

export type SupabaseTaskIncidentPhotosClient = SupabaseClient<Database>

export type UploadTaskIncidentPhotoInput = {
  companyId: string
  incidentId: string
  file: File
  createdBy: string
}

export async function uploadTaskIncidentPhoto(
  client: SupabaseTaskIncidentPhotosClient,
  input: UploadTaskIncidentPhotoInput
): Promise<TaskIncidentsRepositoryResult<TaskIncidentPhoto>> {
  const validationMessage = validateTaskIncidentPhotoFile(input.file)

  if (validationMessage) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: validationMessage,
      },
    }
  }

  const photoId = crypto.randomUUID()
  const sanitizedFileName = sanitizeTaskIncidentPhotoFileName(input.file.name)
  const storagePath = buildTaskIncidentPhotoStoragePath({
    companyId: input.companyId,
    incidentId: input.incidentId,
    photoId,
    fileName: sanitizedFileName,
  })

  const { error: uploadError } = await client.storage
    .from(TASK_INCIDENT_PHOTOS_STORAGE_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: input.file.type,
    })

  if (uploadError) {
    logTaskIncidentPhotoUploadFailed({
      incidentId: input.incidentId,
      fileName: input.file.name,
      storagePath,
      error: uploadError,
    })

    return {
      data: null,
      error: {
        code: "UPLOAD",
        message: "No se pudo subir la fotografía de incidencia.",
      },
    }
  }

  const insertResult = await insertTaskIncidentPhoto(client, {
    incidentId: input.incidentId,
    storagePath,
    fileName: sanitizedFileName,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    createdBy: input.createdBy,
  })

  if (insertResult.error || !insertResult.data) {
    await client.storage
      .from(TASK_INCIDENT_PHOTOS_STORAGE_BUCKET)
      .remove([storagePath])

    logTaskIncidentPhotoUploadFailed({
      incidentId: input.incidentId,
      fileName: input.file.name,
      storagePath,
      error: insertResult.error ?? { message: "No se pudo registrar la fotografía." },
    })

    return {
      data: null,
      error: insertResult.error ?? {
        code: "UNKNOWN",
        message: "No se pudo registrar la fotografía de incidencia.",
      },
    }
  }

  return insertResult
}
