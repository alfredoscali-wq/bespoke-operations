"use client"

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
  return createCommercialEtiqueta(browserClient(), companyId, input)
}

export async function updateCommercialEtiquetaBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialEtiquetaInput
) {
  return updateCommercialEtiqueta(browserClient(), companyId, id, input)
}

export async function removeCommercialEtiquetaBrowser(
  companyId: string,
  id: string
) {
  return softDeleteCommercialEtiqueta(browserClient(), companyId, id)
}
