"use client"

import {
  recordCatalogCreatedActivity,
  recordCatalogDeletedActivity,
  recordCatalogUpdatedActivity,
} from "@/lib/activity/domain/catalog-activity"
import { createClient } from "@/lib/supabase/client"
import {
  createCommercialEtiqueta,
  listCommercialEtiquetas,
  softDeleteCommercialEtiqueta,
  updateCommercialEtiqueta,
  type CommercialEtiquetasClient,
} from "@/lib/supabase/commercial-etiquetas.queries"
import type {
  CreateCommercialEtiquetaInput,
  UpdateCommercialEtiquetaInput,
} from "@/lib/types/commercial-etiquetas"

function browserClient(): CommercialEtiquetasClient {
  return createClient() as CommercialEtiquetasClient
}

export async function listCommercialEtiquetasBrowser(
  companyId: string,
  options?: { activeOnly?: boolean }
) {
  return listCommercialEtiquetas(browserClient(), companyId, options)
}

export async function createCommercialEtiquetaBrowser(
  companyId: string,
  input: CreateCommercialEtiquetaInput
) {
  const result = await createCommercialEtiqueta(browserClient(), companyId, input)
  if (!result.error && result.data) {
    recordCatalogCreatedActivity({
      catalog: "commercial_etiqueta",
      entityId: result.data.id,
    })
  }
  return result
}

export async function updateCommercialEtiquetaBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialEtiquetaInput
) {
  const result = await updateCommercialEtiqueta(
    browserClient(),
    companyId,
    id,
    input
  )
  if (!result.error && result.data) {
    recordCatalogUpdatedActivity({
      catalog: "commercial_etiqueta",
      entityId: result.data.id,
      metadata: { changedFields: Object.keys(input) },
    })
  }
  return result
}

export async function removeCommercialEtiquetaBrowser(
  companyId: string,
  id: string
) {
  const result = await softDeleteCommercialEtiqueta(
    browserClient(),
    companyId,
    id
  )
  if (!result.error && result.data) {
    recordCatalogDeletedActivity({
      catalog: "commercial_etiqueta",
      entityId: id,
    })
  }
  return result
}
