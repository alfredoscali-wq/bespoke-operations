import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreatePayloadToInsert,
  mapEvidenceRowToRecord,
  mapUpdatePayloadToUpdate,
} from "@/lib/supabase/evidences.mapper"
import {
  EVIDENCES_STORAGE_BUCKET,
  buildEvidenceStoragePath,
} from "@/lib/supabase/evidences.storage"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type {
  CreateEvidencePayload,
  EvidencesRepositoryResult,
  UpdateEvidencePayload,
} from "@/lib/types/supabase/evidences"

export type SupabaseEvidencesClient = SupabaseClient<Database>

const SIGNED_URL_TTL_SECONDS = 3600

function mapRowsToRecords(
  rows: Parameters<typeof mapEvidenceRowToRecord>[0][]
): EvidenceRecord[] {
  return rows.map((row) => mapEvidenceRowToRecord(row))
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
    data: mapRowsToRecords(data ?? []),
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

  return {
    data: mapEvidenceRowToRecord(data),
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
    data: mapRowsToRecords(data ?? []),
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
    data: mapRowsToRecords(data ?? []),
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

  return {
    data: mapEvidenceRowToRecord(data),
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

  return {
    data: mapEvidenceRowToRecord(data),
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
