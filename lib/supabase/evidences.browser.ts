import { createClient } from "@/lib/supabase/client"
import {
  fetchEvidenceById,
  fetchEvidences,
  fetchEvidencesByProjectId,
  fetchEvidencesByTaskId,
  getEvidenceSignedUrl,
  insertEvidence,
  patchEvidence,
  removeEvidenceFile,
  uploadEvidenceFile,
  uploadEvidenceWithFile as uploadEvidenceWithFileQuery,
  type SupabaseEvidencesClient,
} from "@/lib/supabase/evidences.queries"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type {
  CreateEvidencePayload,
  EvidencesRepositoryResult,
  UpdateEvidencePayload,
  UploadEvidenceInput,
} from "@/lib/types/supabase/evidences"

export function createBrowserEvidencesClient(): SupabaseEvidencesClient {
  return createClient()
}

export async function listEvidences(
  client: SupabaseEvidencesClient = createBrowserEvidencesClient()
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  return fetchEvidences(client)
}

export async function getEvidenceById(
  id: string,
  client: SupabaseEvidencesClient = createBrowserEvidencesClient()
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return fetchEvidenceById(client, id)
}

export async function listEvidencesByProjectId(
  projectId: string,
  client: SupabaseEvidencesClient = createBrowserEvidencesClient()
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  return fetchEvidencesByProjectId(client, projectId)
}

export async function listEvidencesByTaskId(
  taskId: string,
  client: SupabaseEvidencesClient = createBrowserEvidencesClient()
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  return fetchEvidencesByTaskId(client, taskId)
}

export async function createEvidence(
  payload: CreateEvidencePayload,
  client: SupabaseEvidencesClient = createBrowserEvidencesClient()
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return insertEvidence(client, payload)
}

export async function updateEvidence(
  id: string,
  payload: UpdateEvidencePayload,
  client: SupabaseEvidencesClient = createBrowserEvidencesClient()
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return patchEvidence(client, id, payload)
}

export async function uploadEvidenceWithFile(
  input: UploadEvidenceInput,
  client: SupabaseEvidencesClient = createBrowserEvidencesClient()
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return uploadEvidenceWithFileQuery(client, input)
}

export {
  uploadEvidenceFile,
  getEvidenceSignedUrl,
  removeEvidenceFile,
}
