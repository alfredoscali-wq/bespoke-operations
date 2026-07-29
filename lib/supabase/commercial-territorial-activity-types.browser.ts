"use client"

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
  return createCommercialTerritorialActivityType(
    browserClient(),
    companyId,
    input
  )
}

export async function updateCommercialTerritorialActivityTypeBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialTerritorialActivityTypeInput
) {
  return updateCommercialTerritorialActivityType(
    browserClient(),
    companyId,
    id,
    input
  )
}

export async function removeCommercialTerritorialActivityTypeBrowser(
  companyId: string,
  id: string
) {
  return softDeleteCommercialTerritorialActivityType(
    browserClient(),
    companyId,
    id
  )
}
