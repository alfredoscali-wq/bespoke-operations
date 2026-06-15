import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, EvidenceRow } from "@/lib/supabase/database.types"
import {
  mapCreatePayloadToInsert,
  mapEvidenceRowToRecord,
  mapUpdatePayloadToUpdate,
} from "@/lib/supabase/evidences.mapper"
import {
  EVIDENCE_IMAGE_MIME_TYPES,
  EVIDENCE_MAX_FILE_SIZE_BYTES,
  EVIDENCES_STORAGE_BUCKET,
  buildEvidenceStoragePath,
  getStorageSegmentProjectId,
  getStorageSegmentTaskId,
} from "@/lib/supabase/evidences.storage"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type {
  CreateEvidencePayload,
  EvidencesRepositoryResult,
  UpdateEvidencePayload,
  UploadEvidenceInput,
} from "@/lib/types/supabase/evidences"

export type SupabaseEvidencesClient = SupabaseClient<Database>

const SIGNED_URL_TTL_SECONDS = 3600

async function mapRowsToRecordsWithSignedUrls(
  client: SupabaseEvidencesClient,
  rows: EvidenceRow[]
): Promise<EvidenceRecord[]> {
  if (rows.length === 0) return []

  const pathsToSign = rows
    .filter((row) => row.storage_path)
    .map((row) => row.storage_path as string)

  const signedUrlMap = new Map<string, string>()

  if (pathsToSign.length > 0) {
    const { data, error } = await client.storage
      .from(EVIDENCES_STORAGE_BUCKET)
      .createSignedUrls(pathsToSign, SIGNED_URL_TTL_SECONDS)

    if (!error && data) {
      data.forEach((item) => {
        if (item.path && item.signedUrl && !item.error) {
          signedUrlMap.set(item.path, item.signedUrl)
        }
      })
    }
  }

  return rows.map((row) => {
    const signedUrl = row.storage_path
      ? signedUrlMap.get(row.storage_path) ?? null
      : null

    return mapEvidenceRowToRecord(row, signedUrl)
  })
}

export function mapSupabaseEvidenceError(error: {
  code?: string
  message: string
}) {
  if (error.message.toLowerCase().includes("storage")) {
    return {
      code: "STORAGE" as const,
      message: error.message,
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

function validateEvidenceImageFile(
  file: File
): EvidencesRepositoryResult<EvidenceRecord> | null {
  if (
    !EVIDENCE_IMAGE_MIME_TYPES.includes(
      file.type as (typeof EVIDENCE_IMAGE_MIME_TYPES)[number]
    )
  ) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "Solo se permiten imágenes JPEG, PNG, WebP o HEIC.",
      },
    }
  }

  if (file.size > EVIDENCE_MAX_FILE_SIZE_BYTES) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "La imagen supera el límite de 50 MB.",
      },
    }
  }

  return null
}

export async function fetchEvidences(
  client: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  const { data, error } = await client
    .from("evidences")
    .select("*")
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseEvidenceError(error) }
  }

  return {
    data: await mapRowsToRecordsWithSignedUrls(client, data ?? []),
    error: null,
  }
}

export async function fetchEvidenceById(
  client: SupabaseEvidencesClient,
  id: string
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  const { data, error } = await client
    .from("evidences")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEvidenceError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Evidencia no encontrada.",
      },
    }
  }

  const [record] = await mapRowsToRecordsWithSignedUrls(client, [data])

  return {
    data: record,
    error: null,
  }
}

export async function fetchEvidencesByProjectId(
  client: SupabaseEvidencesClient,
  projectId: string
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  const { data, error } = await client
    .from("evidences")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseEvidenceError(error) }
  }

  return {
    data: await mapRowsToRecordsWithSignedUrls(client, data ?? []),
    error: null,
  }
}

export async function fetchEvidencesByTaskId(
  client: SupabaseEvidencesClient,
  taskId: string
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  const { data, error } = await client
    .from("evidences")
    .select("*")
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseEvidenceError(error) }
  }

  return {
    data: await mapRowsToRecordsWithSignedUrls(client, data ?? []),
    error: null,
  }
}

export async function insertEvidence(
  client: SupabaseEvidencesClient,
  payload: CreateEvidencePayload
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  const { data, error } = await client
    .from("evidences")
    .insert(mapCreatePayloadToInsert(payload))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseEvidenceError(error) }
  }

  const [record] = await mapRowsToRecordsWithSignedUrls(client, [data])

  return {
    data: record,
    error: null,
  }
}

export async function patchEvidence(
  client: SupabaseEvidencesClient,
  id: string,
  payload: UpdateEvidencePayload
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  const update = mapUpdatePayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const { data, error } = await client
    .from("evidences")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEvidenceError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Evidencia no encontrada.",
      },
    }
  }

  const [record] = await mapRowsToRecordsWithSignedUrls(client, [data])

  return {
    data: record,
    error: null,
  }
}

export async function uploadEvidenceFile(
  client: SupabaseEvidencesClient,
  params: {
    projectId: string
    taskId: string
    evidenceId: string
    fileName: string
    file: File | Blob
    contentType?: string
  }
): Promise<
  EvidencesRepositoryResult<{
    bucket: string
    path: string
  }>
> {
  const path = buildEvidenceStoragePath(params)

  const { error } = await client.storage
    .from(EVIDENCES_STORAGE_BUCKET)
    .upload(path, params.file, {
      upsert: false,
      contentType: params.contentType,
    })

  if (error) {
    return {
      data: null,
      error: mapSupabaseEvidenceError(error),
    }
  }

  return {
    data: {
      bucket: EVIDENCES_STORAGE_BUCKET,
      path,
    },
    error: null,
  }
}

export async function uploadEvidenceWithFile(
  client: SupabaseEvidencesClient,
  input: UploadEvidenceInput
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  const validationError = validateEvidenceImageFile(input.file)
  if (validationError) return validationError

  const uploadedAt = new Date().toISOString()
  const metadata: CreateEvidencePayload = {
    fileName: input.file.name,
    type: "photo",
    evidenceType: input.evidenceType ?? "progress-photo",
    projectId: input.projectId || null,
    projectCode: input.projectCode,
    projectName: input.projectName,
    taskId: input.taskId ?? null,
    taskCode: input.taskCode?.trim() || "OBRA",
    taskTitle: input.taskTitle?.trim() || "Evidencia general de obra",
    crew: input.crew?.trim() || "—",
    worker: input.worker,
    uploadedAt,
    status: "pending-review",
    description: input.description ?? "",
    category: input.category ?? "Campo",
    comments: [],
    uploadHistory: [
      {
        id: `ev-h-upload-${Date.now()}`,
        action: "Archivo cargado",
        user: input.worker,
        timestamp: uploadedAt,
        note: input.file.name,
      },
    ],
  }

  const insertResult = await insertEvidence(client, metadata)
  if (insertResult.error || !insertResult.data) {
    return insertResult
  }

  const evidenceId = insertResult.data.id
  const projectSegment = getStorageSegmentProjectId(
    input.projectId,
    input.projectCode
  )
  const taskSegment = getStorageSegmentTaskId(input.taskId, input.taskCode)

  const uploadResult = await uploadEvidenceFile(client, {
    projectId: projectSegment,
    taskId: taskSegment,
    evidenceId,
    fileName: input.file.name,
    file: input.file,
    contentType: input.file.type,
  })

  if (uploadResult.error || !uploadResult.data) {
    return {
      data: null,
      error:
        uploadResult.error ?? {
          code: "STORAGE",
          message: "No se pudo subir el archivo al bucket.",
        },
    }
  }

  return patchEvidence(client, evidenceId, {
    storagePath: uploadResult.data.path,
    mimeType: input.file.type,
    fileSizeBytes: input.file.size,
  })
}

export async function getEvidenceSignedUrl(
  client: SupabaseEvidencesClient,
  storagePath: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS
): Promise<EvidencesRepositoryResult<string>> {
  const { data, error } = await client.storage
    .from(EVIDENCES_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return {
      data: null,
      error: mapSupabaseEvidenceError(
        error ?? { message: "No se pudo generar la URL firmada." }
      ),
    }
  }

  return { data: data.signedUrl, error: null }
}

export async function removeEvidenceFile(
  client: SupabaseEvidencesClient,
  storagePath: string
): Promise<EvidencesRepositoryResult<true>> {
  const { error } = await client.storage
    .from(EVIDENCES_STORAGE_BUCKET)
    .remove([storagePath])

  if (error) {
    return { data: null, error: mapSupabaseEvidenceError(error) }
  }

  return { data: true, error: null }
}
