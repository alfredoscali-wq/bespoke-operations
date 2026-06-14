import type { ProjectInsert, ProjectRow, ProjectUpdate } from "@/lib/supabase/database.types"
import type { Project } from "@/lib/types/projects"
import type {
  CreateProjectPayload,
  UpdateProjectPayload,
} from "@/lib/types/supabase/projects"

export function mapProjectRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    type: row.type,
    status: row.status,
    progress: row.progress,
    startDate: row.start_date,
    endDate: row.end_date,
    supervisor: row.supervisor,
    location: row.location,
    description: row.description,
  }
}

export function mapCreatePayloadToInsert(
  payload: CreateProjectPayload
): ProjectInsert {
  return {
    code: payload.code.trim(),
    name: payload.name.trim(),
    client: payload.client.trim(),
    type: payload.type,
    status: payload.status ?? "planned",
    progress: payload.progress ?? 0,
    start_date: payload.startDate,
    end_date: payload.endDate,
    supervisor: payload.supervisor.trim(),
    location: payload.location.trim(),
    description: payload.description.trim(),
  }
}

export function mapUpdatePayloadToUpdate(
  payload: UpdateProjectPayload
): ProjectUpdate {
  const update: ProjectUpdate = {}

  if (payload.code !== undefined) update.code = payload.code.trim()
  if (payload.name !== undefined) update.name = payload.name.trim()
  if (payload.client !== undefined) update.client = payload.client.trim()
  if (payload.type !== undefined) update.type = payload.type
  if (payload.status !== undefined) update.status = payload.status
  if (payload.progress !== undefined) update.progress = payload.progress
  if (payload.startDate !== undefined) update.start_date = payload.startDate
  if (payload.endDate !== undefined) update.end_date = payload.endDate
  if (payload.supervisor !== undefined) {
    update.supervisor = payload.supervisor.trim()
  }
  if (payload.location !== undefined) update.location = payload.location.trim()
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }

  return update
}
