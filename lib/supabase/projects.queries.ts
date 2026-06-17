import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreatePayloadToInsert,
  mapProjectRowToProject,
  mapUpdatePayloadToUpdate,
} from "@/lib/supabase/projects.mapper"
import {
  mapProjectHistoryEventToInsert,
  mapProjectHistoryRowToEvent,
} from "@/lib/supabase/project-history.mapper"
import type { Project, ProjectHistoryEvent } from "@/lib/types/projects"
import type {
  CreateProjectPayload,
  ProjectsRepositoryResult,
  UpdateProjectPayload,
} from "@/lib/types/supabase/projects"

export type SupabaseProjectsClient = SupabaseClient<Database>

export function mapSupabaseError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return {
      code: "DUPLICATE_CODE" as const,
      message: "Ya existe una obra con ese código.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchProjects(
  client: SupabaseProjectsClient
): Promise<ProjectsRepositoryResult<Project[]>> {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  return {
    data: (data ?? []).map(mapProjectRowToProject),
    error: null,
  }
}

export async function fetchProjectById(
  client: SupabaseProjectsClient,
  id: string
): Promise<ProjectsRepositoryResult<Project>> {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Obra no encontrada.",
      },
    }
  }

  return { data: mapProjectRowToProject(data), error: null }
}

export async function insertProject(
  client: SupabaseProjectsClient,
  payload: CreateProjectPayload
): Promise<ProjectsRepositoryResult<Project>> {
  const { data, error } = await client
    .from("projects")
    .insert(mapCreatePayloadToInsert(payload))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  return { data: mapProjectRowToProject(data), error: null }
}

export async function patchProject(
  client: SupabaseProjectsClient,
  id: string,
  payload: UpdateProjectPayload
): Promise<ProjectsRepositoryResult<Project>> {
  const update = mapUpdatePayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const { data, error } = await client
    .from("projects")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Obra no encontrada.",
      },
    }
  }

  return { data: mapProjectRowToProject(data), error: null }
}

export async function archiveProjectRecord(
  client: SupabaseProjectsClient,
  id: string
): Promise<ProjectsRepositoryResult<void>> {
  const { error } = await client
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  return { data: undefined, error: null }
}

export async function fetchProjectHistory(
  client: SupabaseProjectsClient,
  projectId: string
): Promise<ProjectsRepositoryResult<ProjectHistoryEvent[]>> {
  const { data, error } = await client
    .from("project_history")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  return {
    data: (data ?? []).map(mapProjectHistoryRowToEvent),
    error: null,
  }
}

export async function insertProjectHistoryEvent(
  client: SupabaseProjectsClient,
  projectId: string,
  event: ProjectHistoryEvent
): Promise<ProjectsRepositoryResult<ProjectHistoryEvent>> {
  const { data, error } = await client
    .from("project_history")
    .insert(mapProjectHistoryEventToInsert(projectId, event))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  return { data: mapProjectHistoryRowToEvent(data), error: null }
}
