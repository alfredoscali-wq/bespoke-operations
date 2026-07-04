import "server-only"

import { createClient } from "@/lib/supabase/server"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  fetchCrewById,
  fetchCrews,
  insertCrew,
  insertCrewMember,
  patchCrew,
  patchCrewMember,
  softDeleteCrew,
  softDeleteCrewMember,
  type SupabaseCrewsClient,
} from "@/lib/supabase/crews.queries"
import type { Crew, CrewMember } from "@/lib/types/crews"
import type {
  CreateCrewMemberPayload,
  CreateCrewPayload,
  CrewsRepositoryResult,
  UpdateCrewMemberPayload,
  UpdateCrewPayload,
} from "@/lib/types/supabase/crews"

async function createServerCrewsClient(): Promise<SupabaseCrewsClient> {
  return createClient()
}

export async function listCrews(
  companyId: string = BESPOKE_PRODUCTION_COMPANY_ID,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<Crew[]>> {
  return fetchCrews(client ?? (await createServerCrewsClient()), companyId)
}

export async function getCrewById(
  id: string,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<Crew>> {
  return fetchCrewById(client ?? (await createServerCrewsClient()), id)
}

export async function createCrew(
  payload: CreateCrewPayload,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<Crew>> {
  return insertCrew(client ?? (await createServerCrewsClient()), payload)
}

export async function updateCrew(
  id: string,
  payload: UpdateCrewPayload,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<Crew>> {
  return patchCrew(client ?? (await createServerCrewsClient()), id, payload)
}

export async function deleteCrew(
  id: string,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<void>> {
  return softDeleteCrew(client ?? (await createServerCrewsClient()), id)
}

export async function createCrewMember(
  payload: CreateCrewMemberPayload,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<CrewMember>> {
  return insertCrewMember(
    client ?? (await createServerCrewsClient()),
    payload
  )
}

export async function updateCrewMember(
  id: string,
  payload: UpdateCrewMemberPayload,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<CrewMember>> {
  return patchCrewMember(
    client ?? (await createServerCrewsClient()),
    id,
    payload
  )
}

export async function deleteCrewMember(
  id: string,
  client?: SupabaseCrewsClient
): Promise<CrewsRepositoryResult<void>> {
  return softDeleteCrewMember(
    client ?? (await createServerCrewsClient()),
    id
  )
}

export { createBrowserCrewsClient } from "@/lib/supabase/crews.browser"
