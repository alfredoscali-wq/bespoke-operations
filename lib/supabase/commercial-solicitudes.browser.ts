"use client"

import { createClient } from "@/lib/supabase/client"
import {
  recordRequestCancelledActivity,
  recordRequestCreatedActivity,
  recordRequestPriorityChangedActivity,
  recordRequestResolvedActivity,
  recordRequestStatusChangedActivity,
  recordRequestUpdatedActivity,
  recordRequestWorkOrderGeneratedActivity,
} from "@/lib/activity/domain/requests-activity"
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
  const result = await createCommercialSolicitud(
    browserClient(),
    companyId,
    input,
    actor
  )
  if (result.data) {
    recordRequestCreatedActivity({
      requestId: result.data.id,
      status: result.data.status,
      priority: result.data.priority,
    })
  }
  return result
}

export async function updateCommercialSolicitudBrowser(
  companyId: string,
  id: string,
  input: UpdateCommercialSolicitudInput,
  actor: { employeeId: string | null }
) {
  const client = browserClient()
  const previous =
    input.priority !== undefined || input.status !== undefined
      ? await getCommercialSolicitudById(client, companyId, id)
      : null

  const result = await updateCommercialSolicitud(
    client,
    companyId,
    id,
    input,
    actor
  )

  if (result.data) {
    const changedFields = (
      Object.keys(input) as Array<keyof UpdateCommercialSolicitudInput>
    ).filter((key) => input[key] !== undefined)

    recordRequestUpdatedActivity({
      requestId: result.data.id,
      changedFields,
    })

    if (
      input.priority !== undefined &&
      previous?.data &&
      previous.data.priority !== result.data.priority
    ) {
      recordRequestPriorityChangedActivity({
        requestId: result.data.id,
        oldPriority: previous.data.priority,
        newPriority: result.data.priority,
      })
    }

    if (
      input.status !== undefined &&
      previous?.data &&
      previous.data.status !== result.data.status
    ) {
      recordRequestStatusChangedActivity({
        requestId: result.data.id,
        oldStatus: previous.data.status,
        newStatus: result.data.status,
      })
    }
  }

  return result
}

export async function resolveCommercialSolicitudBrowser(
  companyId: string,
  id: string,
  resolutionCode: CommercialSolicitudResolutionCode,
  actor: { employeeId: string | null }
) {
  const client = browserClient()
  const previous = await getCommercialSolicitudById(client, companyId, id)
  const result = await resolveCommercialSolicitud(
    client,
    companyId,
    id,
    resolutionCode,
    actor
  )

  if (result.data) {
    const oldStatus = previous.data?.status ?? null
    if (result.data.status === "cancelada") {
      recordRequestCancelledActivity({
        requestId: result.data.id,
        oldStatus,
      })
    } else {
      recordRequestResolvedActivity({
        requestId: result.data.id,
        oldStatus,
      })
      if (oldStatus && oldStatus !== result.data.status) {
        recordRequestStatusChangedActivity({
          requestId: result.data.id,
          oldStatus,
          newStatus: result.data.status,
        })
      }
    }
  }

  return result
}

export async function linkCommercialSolicitudToWorkOrderBrowser(
  companyId: string,
  id: string,
  workOrderId: string,
  actor: { employeeId: string | null }
) {
  const client = browserClient()
  const previous = await getCommercialSolicitudById(client, companyId, id)
  const result = await linkCommercialSolicitudToWorkOrder(
    client,
    companyId,
    id,
    workOrderId,
    actor
  )
  if (result.data) {
    recordRequestWorkOrderGeneratedActivity({
      requestId: result.data.id,
      workOrderId,
    })
    const oldStatus = previous.data?.status ?? null
    if (oldStatus && oldStatus !== result.data.status) {
      recordRequestStatusChangedActivity({
        requestId: result.data.id,
        oldStatus,
        newStatus: result.data.status,
      })
    }
  }
  return result
}

export async function cancelCommercialSolicitudBrowser(
  companyId: string,
  id: string,
  actor: { employeeId: string | null }
) {
  const client = browserClient()
  const previous = await getCommercialSolicitudById(client, companyId, id)
  const result = await cancelCommercialSolicitud(client, companyId, id, actor)
  if (result.data) {
    recordRequestCancelledActivity({
      requestId: result.data.id,
      oldStatus: previous.data?.status ?? null,
    })
  }
  return result
}
