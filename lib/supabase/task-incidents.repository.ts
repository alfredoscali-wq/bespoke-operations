import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
  fetchActiveTaskIncidentByTaskId,
  fetchActiveTaskIncidents,
  fetchTaskIncidentById,
  fetchTaskIncidentEvents,
  fetchTaskIncidentPhotos,
  fetchTaskIncidents,
  fetchTaskIncidentsByTaskId,
  insertTaskIncident,
  insertTaskIncidentEvent,
  insertTaskIncidentPhoto,
  patchTaskIncident,
  type SupabaseTaskIncidentsClient,
} from "@/lib/supabase/task-incidents.queries"
import type {
  CreateTaskIncidentEventPayload,
  CreateTaskIncidentPayload,
  CreateTaskIncidentPhotoPayload,
  ListTaskIncidentsFilters,
  TaskIncidentDetail,
  TaskIncidentsRepositoryResult,
  UpdateTaskIncidentStatusPayload,
} from "@/lib/types/supabase/task-incidents"
import type {
  TaskIncident,
  TaskIncidentEvent,
  TaskIncidentPhoto,
} from "@/lib/types/task-incidents"

async function createServerTaskIncidentsClient(): Promise<SupabaseTaskIncidentsClient> {
  return createClient()
}

async function loadIncidentDetail(
  client: SupabaseTaskIncidentsClient,
  incident: TaskIncident
): Promise<TaskIncidentsRepositoryResult<TaskIncidentDetail>> {
  const [photosResult, eventsResult] = await Promise.all([
    fetchTaskIncidentPhotos(client, incident.id),
    fetchTaskIncidentEvents(client, incident.id),
  ])

  if (photosResult.error) {
    return { data: null, error: photosResult.error }
  }

  if (eventsResult.error) {
    return { data: null, error: eventsResult.error }
  }

  return {
    data: {
      ...incident,
      photos: photosResult.data ?? [],
      events: eventsResult.data ?? [],
    },
    error: null,
  }
}

export async function getTaskIncidentById(
  id: string,
  companyId?: string,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncidentDetail>> {
  const resolvedClient = client ?? (await createServerTaskIncidentsClient())
  const incidentResult = await fetchTaskIncidentById(
    resolvedClient,
    id,
    companyId
  )

  if (incidentResult.error || !incidentResult.data) {
    return {
      data: null,
      error: incidentResult.error ?? {
        code: "NOT_FOUND",
        message: "Incidencia no encontrada.",
      },
    }
  }

  return loadIncidentDetail(resolvedClient, incidentResult.data)
}

export async function listTaskIncidents(
  companyId: string,
  filters?: ListTaskIncidentsFilters,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncident[]>> {
  return fetchTaskIncidents(
    client ?? (await createServerTaskIncidentsClient()),
    companyId,
    filters
  )
}

export async function listActiveTaskIncidents(
  companyId: string,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncident[]>> {
  return fetchActiveTaskIncidents(
    client ?? (await createServerTaskIncidentsClient()),
    companyId
  )
}

export async function listTaskIncidentsByTaskId(
  taskId: string,
  companyId?: string,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncident[]>> {
  return fetchTaskIncidentsByTaskId(
    client ?? (await createServerTaskIncidentsClient()),
    taskId,
    companyId
  )
}

export async function findActiveTaskIncidentByTaskId(
  taskId: string,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncident | null>> {
  return fetchActiveTaskIncidentByTaskId(
    client ?? (await createServerTaskIncidentsClient()),
    taskId
  )
}

export async function createTaskIncidentRecord(
  payload: CreateTaskIncidentPayload,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncident>> {
  return insertTaskIncident(
    client ?? (await createServerTaskIncidentsClient()),
    payload
  )
}

export async function updateTaskIncidentRecord(
  id: string,
  payload: UpdateTaskIncidentStatusPayload,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncident>> {
  return patchTaskIncident(
    client ?? (await createServerTaskIncidentsClient()),
    id,
    payload
  )
}

export async function addTaskIncidentEventRecord(
  payload: CreateTaskIncidentEventPayload,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncidentEvent>> {
  return insertTaskIncidentEvent(
    client ?? (await createServerTaskIncidentsClient()),
    payload
  )
}

export async function addTaskIncidentPhotoRecord(
  payload: CreateTaskIncidentPhotoPayload,
  client?: SupabaseTaskIncidentsClient
): Promise<TaskIncidentsRepositoryResult<TaskIncidentPhoto>> {
  return insertTaskIncidentPhoto(
    client ?? (await createServerTaskIncidentsClient()),
    payload
  )
}

export type { SupabaseTaskIncidentsClient }
