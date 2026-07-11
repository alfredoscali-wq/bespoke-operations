import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  resolveTaskStartCoordinatesFromSources,
  type TaskStartCoordinates,
} from "@/lib/mobile/v1/tasks/task-start-coordinates"
import type { Task } from "@/lib/types/tasks"

type AdminClient = SupabaseClient

async function fetchProjectGpsForCompany(
  client: AdminClient,
  companyId: string,
  projectId: string
): Promise<{ latitude: number | null; longitude: number | null } | null> {
  const { data, error } = await client
    .from("projects")
    .select("latitude, longitude")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const latitude =
    typeof data.latitude === "number"
      ? data.latitude
      : data.latitude != null
        ? Number(data.latitude)
        : null
  const longitude =
    typeof data.longitude === "number"
      ? data.longitude
      : data.longitude != null
        ? Number(data.longitude)
        : null

  return {
    latitude: Number.isFinite(latitude as number) ? (latitude as number) : null,
    longitude: Number.isFinite(longitude as number)
      ? (longitude as number)
      : null,
  }
}

/**
 * Resolves operational start coordinates with explicit tenant + soft-delete checks.
 */
export async function resolveTaskStartCoordinates(
  client: AdminClient,
  companyId: string,
  task: Pick<Task, "projectId" | "latitude" | "longitude">
): Promise<TaskStartCoordinates | null> {
  if (!task.projectId) {
    return resolveTaskStartCoordinatesFromSources({
      task,
      project: null,
    })
  }

  const project = await fetchProjectGpsForCompany(
    client,
    companyId,
    task.projectId
  )

  return resolveTaskStartCoordinatesFromSources({
    task,
    project,
  })
}
