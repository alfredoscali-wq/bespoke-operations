import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mapOperationalMotivoRow,
  mapTaskOperationalEventInsert,
  mapTaskOperationalEventRow,
  type OperationalMotivoRow,
  type TaskOperationalEventRow,
} from "@/lib/supabase/operational-control.mapper"
import { slugifyIncidentTypeCode } from "@/lib/incident-types/slugify"
import type {
  OperationalMotivo,
  OperationalMotivoInput,
  OperationalMotivoKind,
  TaskOperationalEvent,
  TaskOperationalEventInsert,
} from "@/lib/types/operational-control"

// Loose client: tables land via migration ahead of generated Database types.
export type OperationalControlClient = SupabaseClient

type RepoError = { code: string; message: string }
type RepoResult<T> =
  | { data: T; error: null }
  | { data: null; error: RepoError }

function mapError(error: { code?: string; message: string }): RepoError {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

export async function fetchOperationalMotivos(
  client: OperationalControlClient,
  companyId: string,
  kind?: OperationalMotivoKind,
  activeOnly = false
): Promise<RepoResult<OperationalMotivo[]>> {
  let query = client
    .from("operational_motivos")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })

  if (kind) {
    query = query.eq("kind", kind)
  }
  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as OperationalMotivoRow[]).map(mapOperationalMotivoRow),
    error: null,
  }
}

export async function insertOperationalMotivo(
  client: OperationalControlClient,
  companyId: string,
  input: OperationalMotivoInput
): Promise<RepoResult<OperationalMotivo>> {
  const label = input.label.trim()
  if (!label) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "El nombre del motivo es obligatorio." },
    }
  }

  const existing = await fetchOperationalMotivos(client, companyId, input.kind)
  const nextOrder =
    existing.data && existing.data.length > 0
      ? Math.max(...existing.data.map((item) => item.sortOrder)) + 1
      : 1

  const code = slugifyIncidentTypeCode(label) || `motivo-${nextOrder}`

  const { data, error } = await client
    .from("operational_motivos")
    .insert({
      company_id: companyId,
      kind: input.kind,
      code,
      label,
      description: input.description?.trim() ?? "",
      is_active: input.isActive ?? true,
      sort_order: nextOrder,
    })
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo crear el motivo." }),
    }
  }

  return {
    data: mapOperationalMotivoRow(data as OperationalMotivoRow),
    error: null,
  }
}

export async function updateOperationalMotivo(
  client: OperationalControlClient,
  id: string,
  companyId: string,
  patch: Partial<OperationalMotivoInput> & { isActive?: boolean }
): Promise<RepoResult<OperationalMotivo>> {
  const update: Record<string, unknown> = {}
  if (patch.label !== undefined) update.label = patch.label.trim()
  if (patch.description !== undefined) {
    update.description = patch.description.trim()
  }
  if (patch.isActive !== undefined) update.is_active = patch.isActive

  const { data, error } = await client
    .from("operational_motivos")
    .update(update)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo actualizar el motivo." }),
    }
  }

  return {
    data: mapOperationalMotivoRow(data as OperationalMotivoRow),
    error: null,
  }
}

export async function deleteOperationalMotivo(
  client: OperationalControlClient,
  id: string,
  companyId: string
): Promise<RepoResult<void>> {
  const { error } = await client
    .from("operational_motivos")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: undefined as unknown as void, error: null }
}

export async function fetchTaskOperationalEvents(
  client: OperationalControlClient,
  companyId: string,
  taskId: string
): Promise<RepoResult<TaskOperationalEvent[]>> {
  const { data, error } = await client
    .from("task_operational_events")
    .select("*")
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .order("occurred_at", { ascending: false })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as TaskOperationalEventRow[]).map(
      mapTaskOperationalEventRow
    ),
    error: null,
  }
}

export async function insertTaskOperationalEvent(
  client: OperationalControlClient,
  input: TaskOperationalEventInsert
): Promise<RepoResult<TaskOperationalEvent>> {
  const { data, error } = await client
    .from("task_operational_events")
    .insert(mapTaskOperationalEventInsert(input))
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo registrar el evento." }),
    }
  }

  return {
    data: mapTaskOperationalEventRow(data as TaskOperationalEventRow),
    error: null,
  }
}
