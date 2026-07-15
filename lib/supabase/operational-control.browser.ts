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
  return insertOperationalMotivo(client(), companyId, input)
}

export async function patchOperationalMotivo(
  id: string,
  companyId: string,
  patch: Partial<OperationalMotivoInput> & { isActive?: boolean }
) {
  return updateOperationalMotivo(client(), id, companyId, patch)
}

export async function removeOperationalMotivo(id: string, companyId: string) {
  return deleteOperationalMotivo(client(), id, companyId)
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
