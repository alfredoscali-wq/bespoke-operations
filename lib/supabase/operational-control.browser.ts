import {
  recordCatalogCreatedActivity,
  recordCatalogDeletedActivity,
  recordCatalogUpdatedActivity,
} from "@/lib/activity/domain/catalog-activity"
import { createClient } from "@/lib/supabase/client"
import {
  deleteOperationalMotivo,
  fetchOperationalMotivos,
  fetchTaskOperationalEvents,
  insertOperationalMotivo,
  insertTaskOperationalEvent,
  updateOperationalMotivo,
  type OperationalControlClient,
} from "@/lib/supabase/operational-control.queries"
import type {
  OperationalMotivoInput,
  OperationalMotivoKind,
  TaskOperationalEventInsert,
} from "@/lib/types/operational-control"

function client(): OperationalControlClient {
  return createClient() as unknown as OperationalControlClient
}

export async function listOperationalMotivos(
  companyId: string,
  kind?: OperationalMotivoKind,
  activeOnly = false
) {
  return fetchOperationalMotivos(client(), companyId, kind, activeOnly)
}

export async function createOperationalMotivo(
  companyId: string,
  input: OperationalMotivoInput
) {
  const result = await insertOperationalMotivo(client(), companyId, input)
  if (!result.error && result.data) {
    recordCatalogCreatedActivity({
      catalog: "operational_motivo",
      entityId: result.data.id,
    })
  }
  return result
}

export async function patchOperationalMotivo(
  id: string,
  companyId: string,
  patch: Partial<OperationalMotivoInput> & { isActive?: boolean }
) {
  const result = await updateOperationalMotivo(client(), id, companyId, patch)
  if (!result.error && result.data) {
    recordCatalogUpdatedActivity({
      catalog: "operational_motivo",
      entityId: result.data.id,
      metadata: { changedFields: Object.keys(patch) },
    })
  }
  return result
}

export async function removeOperationalMotivo(id: string, companyId: string) {
  const result = await deleteOperationalMotivo(client(), id, companyId)
  if (!result.error) {
    recordCatalogDeletedActivity({
      catalog: "operational_motivo",
      entityId: id,
    })
  }
  return result
}

export async function listTaskOperationalEvents(
  companyId: string,
  taskId: string
) {
  return fetchTaskOperationalEvents(client(), companyId, taskId)
}

export async function recordTaskOperationalEvent(
  input: TaskOperationalEventInsert
) {
  const result = await insertTaskOperationalEvent(client(), input)
  if (result.error) {
    console.error(
      "[operational-events] failed to record event",
      input.eventType,
      result.error.message
    )
  }
  return result
}
