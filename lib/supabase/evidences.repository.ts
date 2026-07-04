import "server-only"

import { createClient } from "@/lib/supabase/server"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
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

async function createServerEvidencesClient(): Promise<SupabaseEvidencesClient> {
  return createClient()
}

export async function listEvidences(
  companyId: string = BESPOKE_PRODUCTION_COMPANY_ID,
  client?: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  return fetchEvidences(client ?? (await createServerEvidencesClient()), companyId)
}

export async function getEvidenceById(
  id: string,
  client?: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return fetchEvidenceById(client ?? (await createServerEvidencesClient()), id)
}

export async function listEvidencesByProjectId(
  projectId: string,
  client?: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  return fetchEvidencesByProjectId(
    client ?? (await createServerEvidencesClient()),
    projectId
  )
}

export async function listEvidencesByTaskId(
  taskId: string,
  client?: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord[]>> {
  return fetchEvidencesByTaskId(
    client ?? (await createServerEvidencesClient()),
    taskId
  )
}

export async function createEvidence(
  payload: CreateEvidencePayload,
  client?: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return insertEvidence(client ?? (await createServerEvidencesClient()), payload)
}

export async function updateEvidence(
  id: string,
  payload: UpdateEvidencePayload,
  client?: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return patchEvidence(
    client ?? (await createServerEvidencesClient()),
    id,
    payload
  )
}

export async function uploadEvidenceWithFile(
  input: UploadEvidenceInput,
  client?: SupabaseEvidencesClient
): Promise<EvidencesRepositoryResult<EvidenceRecord>> {
  return uploadEvidenceWithFileQuery(
    client ?? (await createServerEvidencesClient()),
    input
  )
}

export {
  uploadEvidenceFile,
  getEvidenceSignedUrl,
  removeEvidenceFile,
  createBrowserEvidencesClient,
} from "@/lib/supabase/evidences.browser"
