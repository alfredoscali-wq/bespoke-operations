"use client"

import { createClient } from "@/lib/supabase/client"
import {
  createCommercialTerritorialActivity,
  getCommercialTerritorialActivityById,
  listCommercialTerritorialActivities,
  softDeleteCommercialTerritorialActivity,
  type CommercialTerritorialActivitiesClient,
} from "@/lib/supabase/commercial-territorial-activities.queries"
import type { CreateCommercialTerritorialActivityInput } from "@/lib/types/commercial-territorial-activity"

function browserClient(): CommercialTerritorialActivitiesClient {
  return createClient() as CommercialTerritorialActivitiesClient
}

export async function listCommercialTerritorialActivitiesBrowser(
  companyId: string,
  options?: { activityTypeIds?: string[]; limit?: number }
) {
  return listCommercialTerritorialActivities(browserClient(), companyId, options)
}

export async function getCommercialTerritorialActivityByIdBrowser(
  companyId: string,
  id: string
) {
  return getCommercialTerritorialActivityById(browserClient(), companyId, id)
}

export async function createCommercialTerritorialActivityBrowser(
  companyId: string,
  input: CreateCommercialTerritorialActivityInput,
  actor: { employeeId: string | null }
) {
  return createCommercialTerritorialActivity(
    browserClient(),
    companyId,
    input,
    actor
  )
}

export async function removeCommercialTerritorialActivityBrowser(
  companyId: string,
  id: string,
  actor: { employeeId: string | null }
) {
  return softDeleteCommercialTerritorialActivity(
    browserClient(),
    companyId,
    id,
    actor
  )
}
