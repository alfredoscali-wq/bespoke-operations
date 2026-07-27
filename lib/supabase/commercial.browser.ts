import { createClient } from "@/lib/supabase/client"
import {
  fetchCommercialOpportunities,
  fetchCommercialOpportunityById,
  fetchCommercialPeople,
  fetchCommercialPersonById,
  insertCommercialOpportunity,
  insertCommercialPerson,
  patchCommercialOpportunity,
  patchCommercialPerson,
  softDeleteCommercialOpportunity,
  softDeleteCommercialPerson,
  type SupabaseCommercialClient,
} from "@/lib/supabase/commercial.queries"
import type {
  CommercialOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
  CommercialRepositoryResult,
  CreateCommercialOpportunityPayload,
  CreateCommercialPersonPayload,
  UpdateCommercialOpportunityPayload,
  UpdateCommercialPersonPayload,
} from "@/lib/types/supabase/commercial"

export function createBrowserCommercialClient(): SupabaseCommercialClient {
  return createClient()
}

export async function listCommercialPeople(
  companyId: string,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialPerson[]>> {
  return fetchCommercialPeople(client, companyId)
}

export async function getCommercialPersonById(
  id: string,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  return fetchCommercialPersonById(client, id)
}

export async function createCommercialPerson(
  payload: CreateCommercialPersonPayload,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  return insertCommercialPerson(client, payload)
}

export async function updateCommercialPerson(
  id: string,
  payload: UpdateCommercialPersonPayload,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  return patchCommercialPerson(client, id, payload)
}

export async function deleteCommercialPerson(
  id: string,
  deletedBy?: string | null,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialPerson>> {
  return softDeleteCommercialPerson(client, id, deletedBy)
}

export async function listCommercialOpportunities(
  companyId: string,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialOpportunityListItem[]>> {
  return fetchCommercialOpportunities(client, companyId)
}

export async function getCommercialOpportunityById(
  id: string,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  return fetchCommercialOpportunityById(client, id)
}

export async function createCommercialOpportunity(
  payload: CreateCommercialOpportunityPayload,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  return insertCommercialOpportunity(client, payload)
}

export async function updateCommercialOpportunity(
  id: string,
  payload: UpdateCommercialOpportunityPayload,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  return patchCommercialOpportunity(client, id, payload)
}

export async function deleteCommercialOpportunity(
  id: string,
  deletedBy?: string | null,
  client: SupabaseCommercialClient = createBrowserCommercialClient()
): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
  return softDeleteCommercialOpportunity(client, id, deletedBy)
}
