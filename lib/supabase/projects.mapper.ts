import type { ProjectInsert, ProjectRow, ProjectUpdate } from "@/lib/supabase/database.types"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type { ProjectPauseReason, Project } from "@/lib/types/projects"
import type {
  CreateProjectPayload,
  UpdateProjectPayload,
} from "@/lib/types/supabase/projects"

function mapNumericCoord(
  value: number | string | null | undefined
): number | null {
  if (value == null) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapProjectRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    type: row.type,
    status: row.status,
    progress: row.progress,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    supervisor: row.supervisor,
    location: row.location,
    latitude: mapNumericCoord(row.latitude),
    longitude: mapNumericCoord(row.longitude),
    description: row.description,
    pauseReason: (row.pause_reason as ProjectPauseReason | null) ?? undefined,
    pauseNotes: row.pause_notes ?? undefined,
    pausedAt: row.paused_at ?? undefined,
    createdAt: row.created_at,
  }
}

export function mapCreatePayloadToInsert(
  payload: CreateProjectPayload
): ProjectInsert {
  return {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
    code: payload.code.trim(),
    name: payload.name.trim(),
    client: payload.client.trim(),
    type: payload.type,
    status: payload.status ?? "planned",
    progress: payload.progress ?? 0,
    start_date: payload.startDate?.trim() || null,
    end_date: payload.endDate?.trim() || null,
    supervisor: payload.supervisor.trim(),
    location: payload.location.trim(),
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
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
  if (payload.startDate !== undefined) {
    update.start_date = payload.startDate?.trim() || null
  }
  if (payload.endDate !== undefined) {
    update.end_date = payload.endDate?.trim() || null
  }
  if (payload.supervisor !== undefined) {
    update.supervisor = payload.supervisor.trim()
  }
  if (payload.location !== undefined) update.location = payload.location.trim()
  if (payload.latitude !== undefined) update.latitude = payload.latitude
  if (payload.longitude !== undefined) update.longitude = payload.longitude
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.pauseReason !== undefined) {
    update.pause_reason = payload.pauseReason
  }
  if (payload.pauseNotes !== undefined) {
    update.pause_notes = payload.pauseNotes
  }
  if (payload.pausedAt !== undefined) {
    update.paused_at = payload.pausedAt
  }
  if (payload.deletedAt !== undefined) {
    update.deleted_at = payload.deletedAt
  }

  return update
}
