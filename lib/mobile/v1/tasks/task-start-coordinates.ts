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
 * Priority:
 * 1. OT GPS (task.latitude/longitude) — supports multi-point Obras
 * 2. Obra GPS (project) when task has projectId
 * 3. null → TASK_LOCATION_REQUIRED
 */
export function resolveTaskStartCoordinatesFromSources(input: {
  task: Pick<Task, "projectId" | "latitude" | "longitude">
  project: ProjectGpsSource
}): TaskStartCoordinates | null {
  if (hasCoordinates(input.task.latitude, input.task.longitude)) {
    return {
      latitude: input.task.latitude as number,
      longitude: input.task.longitude as number,
      source: "task",
    }
  }

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

  return null
}

export function buildTaskStartLocationRequiredMessage(
  hasProjectId: boolean
): string {
  if (hasProjectId) {
    return "La OT y la Obra no tienen ubicación GPS registrada."
  }

  return "La orden de trabajo no tiene ubicación registrada."
}
