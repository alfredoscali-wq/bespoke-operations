"use client"

import {
  recordCatalogCreatedActivity,
  recordCatalogDeletedActivity,
  recordCatalogUpdatedActivity,
} from "@/lib/activity/domain/catalog-activity"
import { createClient } from "@/lib/supabase/client"
import {
  createCommercialTerritorialActivityType,
  listCommercialTerritorialActivityTypes,
  softDeleteCommercialTerritorialActivityType,
  updateCommercialTerritorialActivityType,
  type CommercialTerritorialActivityTypesClient,
} from "@/lib/supabase/commercial-territorial-activity-types.queries"
import type {
  CreateCommercialTerritorialActivityTypeInput,
  UpdateCommercialTerritorialActivityTypeInput,
} from "@/lib/types/commercial-territorial-activity"

function browserClient(): CommercialTerritorialActivityTypesClient {
  return createClient() as CommercialTerritorialActivityTypesClient
}

export async function listCommercialTerritorialActivityTypesBrowser(
  companyId: string,
  options?: { activeOnly?: boolean }
) {
  return listCommercialTerritorialActivityTypes(
    browserClient(),
    companyId,
    options
  )
}

export async function createCommercialTerritorialActivityTypeBrowser(
  companyId: string,
  input: CreateCommercialTerritorialActivityTypeInput
) {
  const result = await createCommercialTerritorialActivityType(
    browserClient(),
    companyId,
    input
  )
  if (!result.error && result.data) {
    recordCatalogCreatedActivity({
      catalog: "territorial_activity_type",
      entityId: result.data.id,
    })
  }
  return result
}

export async function updateCommercialTerritorialActivityTypeBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialTerritorialActivityTypeInput
) {
  const result = await updateCommercialTerritorialActivityType(
    browserClient(),
    companyId,
    id,
    input
  )
  if (!result.error && result.data) {
    recordCatalogUpdatedActivity({
      catalog: "territorial_activity_type",
      entityId: result.data.id,
      metadata: { changedFields: Object.keys(input) },
    })
  }
  return result
}

export async function removeCommercialTerritorialActivityTypeBrowser(
  companyId: string,
  id: string
) {
  const result = await softDeleteCommercialTerritorialActivityType(
    browserClient(),
    companyId,
    id
  )
  if (!result.error && result.data) {
    recordCatalogDeletedActivity({
      catalog: "territorial_activity_type",
      entityId: id,
    })
  }
  return result
}
