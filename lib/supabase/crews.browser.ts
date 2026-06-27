import { createClient } from "@/lib/supabase/client"
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

export function createBrowserCrewsClient(): SupabaseCrewsClient {
  return createClient()
}

export async function listCrews(
  companyId: string,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<Crew[]>> {
  return fetchCrews(client, companyId)
}

export async function getCrewByIdFromSupabase(
  id: string,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<Crew>> {
  return fetchCrewById(client, id)
}

export async function createCrew(
  payload: CreateCrewPayload,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<Crew>> {
  return insertCrew(client, payload)
}

export async function updateCrew(
  id: string,
  payload: UpdateCrewPayload,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<Crew>> {
  return patchCrew(client, id, payload)
}

export async function deleteCrew(
  id: string,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<void>> {
  return softDeleteCrew(client, id)
}

export async function createCrewMember(
  payload: CreateCrewMemberPayload,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<CrewMember>> {
  return insertCrewMember(client, payload)
}

export async function updateCrewMember(
  id: string,
  payload: UpdateCrewMemberPayload,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<CrewMember>> {
  return patchCrewMember(client, id, payload)
}

export async function deleteCrewMember(
  id: string,
  client: SupabaseCrewsClient = createBrowserCrewsClient()
): Promise<CrewsRepositoryResult<void>> {
  return softDeleteCrewMember(client, id)
}
