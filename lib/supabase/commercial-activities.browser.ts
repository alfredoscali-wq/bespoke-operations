import { createClient } from "@/lib/supabase/client"
import {
  fetchCommercialActivitiesByOpportunity,
  fetchCommercialActivityById,
  fetchCommercialActivityTypes,
  insertCommercialActivity,
  patchCommercialActivity,
  softDeleteCommercialActivity,
  type SupabaseCommercialActivitiesClient,
} from "@/lib/supabase/commercial-activities.queries"
import type {
  CommercialActivity,
  CommercialActivityListItem,
  CommercialActivityType,
} from "@/lib/types/commercial-activities"
import type {
  CommercialActivityRepositoryResult,
  CreateCommercialActivityPayload,
  UpdateCommercialActivityPayload,
} from "@/lib/types/supabase/commercial-activities"

export function createBrowserCommercialActivitiesClient(): SupabaseCommercialActivitiesClient {
  return createClient()
}

export async function listCommercialActivityTypes(
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivityType[]>> {
  return fetchCommercialActivityTypes(client)
}

export async function listCommercialActivitiesByOpportunity(
  companyId: string,
  opportunityId: string,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem[]>> {
  return fetchCommercialActivitiesByOpportunity(client, companyId, opportunityId)
}

export async function getCommercialActivityById(
  id: string,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
  return fetchCommercialActivityById(client, id)
}

export async function createCommercialActivity(
  payload: CreateCommercialActivityPayload,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
  return insertCommercialActivity(client, payload)
}

export async function updateCommercialActivity(
  id: string,
  payload: UpdateCommercialActivityPayload,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
  return patchCommercialActivity(client, id, payload)
}

export async function deleteCommercialActivity(
  id: string,
  deletedBy?: string | null,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivity>> {
  return softDeleteCommercialActivity(client, id, deletedBy)
}
