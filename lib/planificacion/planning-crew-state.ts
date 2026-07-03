import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

import type { PlanningFilters } from "@/lib/planificacion/planning-utils"

export type CrewPlanningStatus = "editable" | "planned"

/** OT visibles durante la sesión de planificación (antes de confirmar la jornada). */
export function filterPlanningSessionTasks(
  tasks: Task[],
  filters: PlanningFilters
): Task[] {
  return tasks.filter((task) => {
    if (!isWorkOrderTask(task) || task.dueDate !== filters.date) {
      return false
    }

    return task.status === "programada" || task.status === "asignada"
  })
}

export function listPlanningSessionTasksForCrew(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): Task[] {
  return filterPlanningSessionTasks(tasks, { date }).filter((task) =>
    taskMatchesCrewId(task, crew)
  )
}

export function resolveCrewPlanningStatus(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): CrewPlanningStatus | null {
  const crewTasks = listPlanningSessionTasksForCrew(tasks, date, crew)

  if (crewTasks.length === 0) {
    return null
  }

  const hasProgrammed = crewTasks.some((task) => task.status === "programada")

  return hasProgrammed ? "editable" : "planned"
}

export function isCrewPlanningComplete(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): boolean {
  return resolveCrewPlanningStatus(tasks, date, crew) === "planned"
}

export function listActiveCrewsWithPlanningTasks(
  tasks: Task[],
  date: string,
  activeCrews: Crew[]
): Crew[] {
  const sessionTasks = filterPlanningSessionTasks(tasks, { date })

  return activeCrews.filter((crew) =>
    sessionTasks.some((task) => taskMatchesCrewId(task, crew))
  )
}

export function listReopenablePlanningTaskIdsForCrew(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): string[] {
  return listPlanningSessionTasksForCrew(tasks, date, crew)
    .filter((task) => task.status === "asignada")
    .map((task) => task.id)
}

export function isTaskPlanningEditable(task: Pick<Task, "status">): boolean {
  return task.status === "programada"
}

export function isJourneyFullyPlanned(
  tasks: Task[],
  date: string,
  activeCrews: Crew[]
): boolean {
  const crewsWithTasks = listActiveCrewsWithPlanningTasks(tasks, date, activeCrews)

  if (crewsWithTasks.length === 0) {
    return false
  }

  return crewsWithTasks.every((crew) => isCrewPlanningComplete(tasks, date, crew))
}
