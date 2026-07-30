"use client"

import { createClient } from "@/lib/supabase/client"
import type { CommercialSolicitudResolutionCode } from "@/lib/commercial/solicitud-catalogs"
import {
  cancelCommercialSolicitud,
  createCommercialSolicitud,
  getCommercialSolicitudById,
  linkCommercialSolicitudToWorkOrder,
  listCommercialSolicitudesByOpportunity,
  resolveCommercialSolicitud,
  updateCommercialSolicitud,
  type CommercialSolicitudesClient,
} from "@/lib/supabase/commercial-solicitudes.queries"
import type {
  CreateCommercialSolicitudInput,
  UpdateCommercialSolicitudInput,
} from "@/lib/types/commercial-solicitudes"

function browserClient(): CommercialSolicitudesClient {
  return createClient() as CommercialSolicitudesClient
}

export async function listCommercialSolicitudesByOpportunityBrowser(
  companyId: string,
  opportunityId: string
) {
  return listCommercialSolicitudesByOpportunity(
    browserClient(),
    companyId,
    opportunityId
  )
}

export async function getCommercialSolicitudByIdBrowser(
  companyId: string,
  id: string
) {
  return getCommercialSolicitudById(browserClient(), companyId, id)
}

export async function createCommercialSolicitudBrowser(
  companyId: string,
  input: CreateCommercialSolicitudInput,
  actor: { employeeId: string | null }
) {
  return createCommercialSolicitud(browserClient(), companyId, input, actor)
}

export async function updateCommercialSolicitudBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialSolicitudInput,
  actor: { employeeId: string | null }
) {
  return updateCommercialSolicitud(
    browserClient(),
    companyId,
    id,
    input,
    actor
  )
}

export async function resolveCommercialSolicitudBrowser(
  companyId: string,
  id: string,
  resolutionCode: CommercialSolicitudResolutionCode,
  actor: { employeeId: string | null }
) {
  return resolveCommercialSolicitud(
    browserClient(),
    companyId,
    id,
    resolutionCode,
    actor
  )
}

export async function linkCommercialSolicitudToWorkOrderBrowser(
  companyId: string,
  id: string,
  workOrderId: string,
  actor: { employeeId: string | null }
) {
  return linkCommercialSolicitudToWorkOrder(
    browserClient(),
    companyId,
    id,
    workOrderId,
    actor
  )
}

export async function cancelCommercialSolicitudBrowser(
  companyId: string,
  id: string,
  actor: { employeeId: string | null }
) {
  return cancelCommercialSolicitud(browserClient(), companyId, id, actor)
}
