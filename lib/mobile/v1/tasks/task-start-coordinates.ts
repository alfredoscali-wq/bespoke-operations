import { hasCoordinates } from "@/lib/gps/coordinates"
import type { Task } from "@/lib/types/tasks"

export type TaskStartCoordinates = {
  latitude: number
  longitude: number
  source: "task" | "project"
}

export type ProjectGpsSource = {
  latitude: number | null
  longitude: number | null
} | null

/**
 * Pure resolution of operational start coordinates.
 * - OT normal (no projectId): task.latitude/longitude
 * - Obra task: project GPS only (caller must have filtered by company + not deleted)
 */
export function resolveTaskStartCoordinatesFromSources(input: {
  task: Pick<Task, "projectId" | "latitude" | "longitude">
  project: ProjectGpsSource
}): TaskStartCoordinates | null {
  if (input.task.projectId) {
    if (!input.project) {
      return null
    }

    if (!hasCoordinates(input.project.latitude, input.project.longitude)) {
      return null
    }

    return {
      latitude: input.project.latitude as number,
      longitude: input.project.longitude as number,
      source: "project",
    }
  }

  if (!hasCoordinates(input.task.latitude, input.task.longitude)) {
    return null
  }

  return {
    latitude: input.task.latitude as number,
    longitude: input.task.longitude as number,
    source: "task",
  }
}

export function buildTaskStartLocationRequiredMessage(
  hasProjectId: boolean
): string {
  if (hasProjectId) {
    return "La Obra no tiene ubicación GPS registrada."
  }

  return "La orden de trabajo no tiene ubicación registrada."
}
