import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateTaskIncidentEventInputToInsert,
  mapCreateTaskIncidentInputToInsert,
  mapCreateTaskIncidentPhotoInputToInsert,
  mapTaskIncidentEventRowToTaskIncidentEvent,
  mapTaskIncidentPhotoRowToTaskIncidentPhoto,
  mapTaskIncidentRowToTaskIncident,
  mapUpdateTaskIncidentInputToUpdate,
} from "@/lib/supabase/task-incidents.mapper"
import type {
  TaskIncident,
  TaskIncidentEvent,
  TaskIncidentPhoto,
  TaskIncidentStatus,
} from "@/lib/types/task-incidents"
import type {
  CreateTaskIncidentEventPayload,
  CreateTaskIncidentPayload,
  CreateTaskIncidentPhotoPayload,
  ListTaskIncidentsFilters,
  TaskIncidentsRepositoryResult,
  UpdateTaskIncidentStatusPayload,
} from "@/lib/types/supabase/task-incidents"

export type SupabaseTaskIncidentsClient = SupabaseClient<Database>

const ACTIVE_INCIDENT_STATUSES: TaskIncidentStatus[] = [
  "REPORTADA",
  "EN_ANALISIS",
]

export function mapSupabaseTaskIncidentError(error: {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}) {
  if (error.code === "23505") {
    const detail = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`

    if (detail.includes("task_incidents_one_active_per_task_idx")) {
      return {
        code: "DUPLICATE_ACTIVE" as const,
        message: "Ya existe una incidencia activa para esta orden de trabajo.",
      }
    }

    return {
      code: "VALIDATION" as const,
      message: error.message,
    }
  }

  if (error.code === "23514") {
    return {
      code: "VALIDATION" as const,
      message: error.message,
    }
  }

  if (error.code === "42501") {
    return {
      code: "FORBIDDEN" as const,
      message: "Permisos insuficientes para realizar esta operación.",
    }
  }

  if (error.code === "22P02") {
    return {
      code: "VALIDATION" as const,
      message: "Identificador inválido.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchTaskIncidentById(
  client: SupabaseTaskIncidentsClient,
  id: string,
  companyId?: string
): Promise<TaskIncidentsRepositoryResult<TaskIncident>> {
  let query = client
    .from("task_incidents")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseTaskIncidentError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Incidencia no encontrada.",
      },
    }
  }

  return {
    data: mapTaskIncidentRowToTaskIncident(data),
    error: null,
  }
}

export async function fetchTaskIncidents(
  client: SupabaseTaskIncidentsClient,
  companyId: string,
  filters?: ListTaskIncidentsFilters
): Promise<TaskIncidentsRepositoryResult<TaskIncident[]>> {
  let query = client
    .from("task_incidents")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (filters?.taskId) {
    query = query.eq("task_id", filters.taskId)
  }

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.activeOnly) {
    query = query.in("status", ACTIVE_INCIDENT_STATUSES)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: mapSupabaseTaskIncidentError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskIncidentRowToTaskIncident),
    error: null,
  }
}

export async function fetchActiveTaskIncidents(
  client: SupabaseTaskIncidentsClient,
  companyId: string
): Promise<TaskIncidentsRepositoryResult<TaskIncident[]>> {
  return fetchTaskIncidents(client, companyId, { activeOnly: true })
}

export async function fetchTaskIncidentsByTaskId(
  client: SupabaseTaskIncidentsClient,
  taskId: string,
  companyId?: string
): Promise<TaskIncidentsRepositoryResult<TaskIncident[]>> {
  let query = client
    .from("task_incidents")
    .select("*")
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: mapSupabaseTaskIncidentError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskIncidentRowToTaskIncident),
    error: null,
  }
}

export async function fetchActiveTaskIncidentByTaskId(
  client: SupabaseTaskIncidentsClient,
  taskId: string
): Promise<TaskIncidentsRepositoryResult<TaskIncident | null>> {
  const { data, error } = await client
    .from("task_incidents")
    .select("*")
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .in("status", ACTIVE_INCIDENT_STATUSES)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseTaskIncidentError(error) }
  }

  return {
    data: data ? mapTaskIncidentRowToTaskIncident(data) : null,
    error: null,
  }
}

export async function insertTaskIncident(
  client: SupabaseTaskIncidentsClient,
  payload: CreateTaskIncidentPayload
): Promise<TaskIncidentsRepositoryResult<TaskIncident>> {
  const { companyId, ...input } = payload

  const { data, error } = await client
    .from("task_incidents")
    .insert(mapCreateTaskIncidentInputToInsert(companyId, input))
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapSupabaseTaskIncidentError(
        error ?? { message: "No se pudo crear la incidencia." }
      ),
    }
  }

  return {
    data: mapTaskIncidentRowToTaskIncident(data),
    error: null,
  }
}

export async function patchTaskIncident(
  client: SupabaseTaskIncidentsClient,
  id: string,
  payload: UpdateTaskIncidentStatusPayload
): Promise<TaskIncidentsRepositoryResult<TaskIncident>> {
  const { data, error } = await client
    .from("task_incidents")
    .update(mapUpdateTaskIncidentInputToUpdate(payload))
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseTaskIncidentError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Incidencia no encontrada.",
      },
    }
  }

  return {
    data: mapTaskIncidentRowToTaskIncident(data),
    error: null,
  }
}

export async function insertTaskIncidentEvent(
  client: SupabaseTaskIncidentsClient,
  payload: CreateTaskIncidentEventPayload
): Promise<TaskIncidentsRepositoryResult<TaskIncidentEvent>> {
  const { data, error } = await client
    .from("task_incident_events")
    .insert(
      mapCreateTaskIncidentEventInputToInsert({
        incidentId: payload.incidentId,
        eventType: payload.eventType,
        comment: payload.comment,
        createdBy: payload.createdBy,
      })
    )
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapSupabaseTaskIncidentError(
        error ?? { message: "No se pudo registrar el evento de incidencia." }
      ),
    }
  }

  return {
    data: mapTaskIncidentEventRowToTaskIncidentEvent(data),
    error: null,
  }
}

export async function insertTaskIncidentPhoto(
  client: SupabaseTaskIncidentsClient,
  payload: CreateTaskIncidentPhotoPayload
): Promise<TaskIncidentsRepositoryResult<TaskIncidentPhoto>> {
  const { data, error } = await client
    .from("task_incident_photos")
    .insert(
      mapCreateTaskIncidentPhotoInputToInsert({
        incidentId: payload.incidentId,
        storagePath: payload.storagePath,
        thumbnailPath: payload.thumbnailPath,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        createdBy: payload.createdBy,
      })
    )
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapSupabaseTaskIncidentError(
        error ?? { message: "No se pudo registrar la fotografía de incidencia." }
      ),
    }
  }

  return {
    data: mapTaskIncidentPhotoRowToTaskIncidentPhoto(data),
    error: null,
  }
}

export async function fetchTaskIncidentEvents(
  client: SupabaseTaskIncidentsClient,
  incidentId: string
): Promise<TaskIncidentsRepositoryResult<TaskIncidentEvent[]>> {
  const { data, error } = await client
    .from("task_incident_events")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseTaskIncidentError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskIncidentEventRowToTaskIncidentEvent),
    error: null,
  }
}

export async function fetchTaskIncidentPhotos(
  client: SupabaseTaskIncidentsClient,
  incidentId: string
): Promise<TaskIncidentsRepositoryResult<TaskIncidentPhoto[]>> {
  const { data, error } = await client
    .from("task_incident_photos")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseTaskIncidentError(error) }
  }

  return {
    data: (data ?? []).map(mapTaskIncidentPhotoRowToTaskIncidentPhoto),
    error: null,
  }
}
