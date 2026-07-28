import "server-only"

import { hasCoordinates } from "@/lib/gps/coordinates"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"

export type PresenceTargetCoordinates = {
  latitude: number
  longitude: number
  source: "task" | "project"
}

type TaskGpsRow = {
  id: string
  project_id: string | null
  latitude: number | null
  longitude: number | null
}

/**
 * Resolves the operational presence target GPS.
 * Architecture rule (Master Context): GPS belongs to the Obra when the OT
 * is linked to a project; otherwise GPS belongs to the OT.
 */
export async function resolvePresenceTargetCoordinates(
  companyId: string,
  taskId: string,
  client: SupabaseClient = createAdminClient()
): Promise<PresenceTargetCoordinates | null> {
  const { data: task, error } = await client
    .from("tasks")
    .select("id, project_id, latitude, longitude")
    .eq("id", taskId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!task) {
    return null
  }

  const row = task as TaskGpsRow

  if (row.project_id) {
    const { data: project, error: projectError } = await client
      .from("projects")
      .select("latitude, longitude")
      .eq("id", row.project_id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle()

    if (projectError) {
      throw projectError
    }

    if (!project) {
      return null
    }

    const latitude =
      typeof project.latitude === "number"
        ? project.latitude
        : project.latitude != null
          ? Number(project.latitude)
          : null
    const longitude =
      typeof project.longitude === "number"
        ? project.longitude
        : project.longitude != null
          ? Number(project.longitude)
          : null

    if (!hasCoordinates(latitude, longitude)) {
      return null
    }

    return {
      latitude: latitude as number,
      longitude: longitude as number,
      source: "project",
    }
  }

  const latitude =
    typeof row.latitude === "number"
      ? row.latitude
      : row.latitude != null
        ? Number(row.latitude)
        : null
  const longitude =
    typeof row.longitude === "number"
      ? row.longitude
      : row.longitude != null
        ? Number(row.longitude)
        : null

  if (!hasCoordinates(latitude, longitude)) {
    return null
  }

  return {
    latitude: latitude as number,
    longitude: longitude as number,
    source: "task",
  }
}
