import type { Task } from "@/lib/types/tasks"

export function resolvePlanningTaskCrewObservations(
  task: Pick<Task, "observationsForCrew" | "description">
): string | null {
  const observationsForCrew = task.observationsForCrew?.trim()
  if (observationsForCrew) {
    return observationsForCrew
  }

  const description = task.description?.trim()
  if (description) {
    return description
  }

  return null
}

export function hasPlanningTaskCrewObservations(
  task: Pick<Task, "observationsForCrew" | "description">
): boolean {
  return resolvePlanningTaskCrewObservations(task) != null
}
