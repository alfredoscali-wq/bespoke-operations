"use client"

import {
  recordCatalogCreatedActivity,
  recordCatalogDeletedActivity,
  recordCatalogUpdatedActivity,
} from "@/lib/activity/domain/catalog-activity"
import { createClient } from "@/lib/supabase/client"
import {
  createCommercialSolicitudType,
  ensureDefaultCommercialSolicitudTypes,
  listCommercialSolicitudTypes,
  softDeleteCommercialSolicitudType,
  updateCommercialSolicitudType,
  type CommercialSolicitudTypesClient,
} from "@/lib/supabase/commercial-solicitud-types.queries"
import type {
  CreateCommercialSolicitudTypeInput,
  UpdateCommercialSolicitudTypeInput,
} from "@/lib/types/commercial-solicitudes"

function browserClient(): CommercialSolicitudTypesClient {
  return createClient() as CommercialSolicitudTypesClient
}

export async function listCommercialSolicitudTypesBrowser(
  companyId: string,
  options?: { activeOnly?: boolean; ensureDefaults?: boolean }
) {
  if (options?.ensureDefaults) {
    const ensured = await ensureDefaultCommercialSolicitudTypes(
      browserClient(),
      companyId
    )
    if (ensured.error) return ensured
    if (options.activeOnly) {
      return {
        data: (ensured.data ?? []).filter((entry) => entry.isActive),
        error: null,
      }
    }
    return ensured
  }
  return listCommercialSolicitudTypes(browserClient(), companyId, options)
}

export async function createCommercialSolicitudTypeBrowser(
  companyId: string,
  input: CreateCommercialSolicitudTypeInput
) {
  const result = await createCommercialSolicitudType(
    browserClient(),
    companyId,
    input
  )
  if (!result.error && result.data) {
    recordCatalogCreatedActivity({
      catalog: "solicitud_type",
      entityId: result.data.id,
    })
  }
  return result
}

export async function updateCommercialSolicitudTypeBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialSolicitudTypeInput
) {
  const result = await updateCommercialSolicitudType(
    browserClient(),
    companyId,
    id,
    input
  )
  if (!result.error && result.data) {
    recordCatalogUpdatedActivity({
      catalog: "solicitud_type",
      entityId: result.data.id,
      metadata: { changedFields: Object.keys(input) },
    })
  }
  return result
}

export async function removeCommercialSolicitudTypeBrowser(
  companyId: string,
  id: string
) {
  const result = await softDeleteCommercialSolicitudType(
    browserClient(),
    companyId,
    id
  )
  if (!result.error && result.data) {
    recordCatalogDeletedActivity({
      catalog: "solicitud_type",
      entityId: id,
    })
  }
  return result
}
