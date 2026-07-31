import {
  recordCommercialActivityCompletedActivity,
  recordCommercialActivityCreatedActivity,
  recordCommercialActivityDeletedActivity,
  recordCommercialActivityUpdatedActivity,
} from "@/lib/activity/domain/commercial-activities-activity"
import { createClient } from "@/lib/supabase/client"
import {
  fetchCommercialActivitiesByOpportunity,
  fetchCommercialActivityById,
  fetchCommercialActivityStats,
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
  options?: { limit?: number; offset?: number },
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<
  CommercialActivityRepositoryResult<CommercialActivityListItem[]> & {
    hasMore?: boolean
    totalCount?: number
  }
> {
  return fetchCommercialActivitiesByOpportunity(
    client,
    companyId,
    opportunityId,
    options
  )
}

export async function getCommercialActivityStats(
  companyId: string,
  opportunityId: string,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<
  CommercialActivityRepositoryResult<{
    total: number
    pending: number
    completed: number
  }>
> {
  return fetchCommercialActivityStats(client, companyId, opportunityId)
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
  const result = await insertCommercialActivity(client, payload)
  if (result.data) {
    recordCommercialActivityCreatedActivity({
      activityId: result.data.id,
      status: result.data.status,
    })
  }
  return result
}

export async function updateCommercialActivity(
  id: string,
  payload: UpdateCommercialActivityPayload,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
  const previous =
    payload.status === "completed"
      ? await fetchCommercialActivityById(client, id)
      : null

  const result = await patchCommercialActivity(client, id, payload)

  if (result.data) {
    const oldStatus = previous?.data?.status ?? null
    if (
      result.data.status === "completed" &&
      oldStatus !== null &&
      oldStatus !== "completed"
    ) {
      recordCommercialActivityCompletedActivity({
        activityId: result.data.id,
        oldStatus,
      })
    } else {
      const changedFields = (
        Object.keys(payload) as Array<keyof UpdateCommercialActivityPayload>
      ).filter((key) => key !== "updatedBy" && payload[key] !== undefined)

      recordCommercialActivityUpdatedActivity({
        activityId: result.data.id,
        changedFields,
      })
    }
  }

  return result
}

export async function deleteCommercialActivity(
  id: string,
  deletedBy?: string | null,
  client: SupabaseCommercialActivitiesClient = createBrowserCommercialActivitiesClient()
): Promise<CommercialActivityRepositoryResult<CommercialActivity>> {
  const result = await softDeleteCommercialActivity(client, id, deletedBy)
  if (!result.error) {
    recordCommercialActivityDeletedActivity({ activityId: id })
  }
  return result
}
