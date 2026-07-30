"use client"

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
  return createCommercialSolicitudType(browserClient(), companyId, input)
}

export async function updateCommercialSolicitudTypeBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialSolicitudTypeInput
) {
  return updateCommercialSolicitudType(browserClient(), companyId, id, input)
}

export async function removeCommercialSolicitudTypeBrowser(
  companyId: string,
  id: string
) {
  return softDeleteCommercialSolicitudType(browserClient(), companyId, id)
}
