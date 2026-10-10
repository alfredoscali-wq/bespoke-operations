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
import { findActiveTasksForProject } from "@/lib/supabase/tasks.queries"
import {
  PROJECT_ARCHIVE_BLOCKED_ACTIVE_TASKS_MESSAGE,
  PROJECT_DELETE_USER_MESSAGE,
} from "@/lib/operations/user-messages"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import {
  buildAutoActivateHistoryDescription,
  shouldAutoActivateProjectByStartDate,
} from "@/lib/projects/project-auto-activate"

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

export async function activateDuePlannedProjects(
  client: SupabaseProjectsClient,
  options: { companyId: string; today?: string }
): Promise<number> {
  const companyId = options.companyId.trim()
  if (!companyId) {
    return 0
  }

  const today = options.today ?? toLocalDateOnly()
  const query = client
    .from("projects")
    .select("id, company_id, status, start_date")
    .eq("company_id", companyId)
    .eq("status", "planned")
    .is("deleted_at", null)
    .not("start_date", "is", null)
    .lte("start_date", today)

  const { data, error } = await query
  if (error || !data?.length) {
    return 0
  }

  let activated = 0
  for (const row of data) {
    if (
      !shouldAutoActivateProjectByStartDate({
        status: row.status,
        startDate: row.start_date,
      }, today)
    ) {
      continue
    }

    const updated = await patchProject(client, row.id, { status: "active" })
    if (updated.error || !updated.data) {
      continue
    }

    await insertProjectHistoryEvent(
      client,
      row.id,
      {
        id: row.id,
        eventType: "status_changed",
        title: "Cambio de estado",
        description: buildAutoActivateHistoryDescription("planned"),
        user: "Sistema",
        timestamp: new Date().toISOString(),
        metadata: {
          previousStatus: "planned",
          nextStatus: "active",
          reason: "start_date",
        },
      },
      row.company_id
    )
    activated += 1
  }

  return activated
}

export async function fetchProjects(
  client: SupabaseProjectsClient,
  companyId: string
): Promise<ProjectsRepositoryResult<Project[]>> {
  try {
    await activateDuePlannedProjects(client, { companyId })
  } catch {
    // Activation must not block listing obras.
  }

  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("company_id", companyId)
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
  id: string,
  companyId?: string
): Promise<ProjectsRepositoryResult<Project>> {
  if (companyId?.trim()) {
    try {
      await activateDuePlannedProjects(client, { companyId })
    } catch {
      // Activation must not block reading the obra.
    }
  }

  let query = client
    .from("projects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)

  if (companyId) {
    query = query.eq("company_id", companyId)
  }

  const { data, error } = await query.maybeSingle()

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
  // Do not chain .select() — soft delete sets deleted_at, so return=representation
  // would re-read the row under SELECT RLS (deleted_at IS NULL) and fail with 42501
  // even when the UPDATE succeeded.
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

export async function archiveProjectWhenEligible(
  client: SupabaseProjectsClient,
  id: string
): Promise<ProjectsRepositoryResult<void>> {
  const projectResult = await fetchProjectById(client, id)
  if (projectResult.error || !projectResult.data) {
    return {
      data: null,
      error: projectResult.error ?? {
        code: "NOT_FOUND",
        message: "Obra no encontrada.",
      },
    }
  }

  const activeTasksResult = await findActiveTasksForProject(
    client,
    id,
    projectResult.data.code
  )

  if (activeTasksResult.error) {
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: PROJECT_DELETE_USER_MESSAGE,
      },
    }
  }

  if (activeTasksResult.data.tasks.length > 0) {
    return {
      data: null,
      error: {
        code: "ACTIVE_TASKS",
        message: PROJECT_ARCHIVE_BLOCKED_ACTIVE_TASKS_MESSAGE,
      },
    }
  }

  return archiveProjectRecord(client, id)
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
  event: ProjectHistoryEvent,
  companyId?: string
): Promise<ProjectsRepositoryResult<ProjectHistoryEvent>> {
  const { data, error } = await client
    .from("project_history")
    .insert(mapProjectHistoryEventToInsert(projectId, event, companyId))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseError(error) }
  }

  return { data: mapProjectHistoryRowToEvent(data), error: null }
}
