import { taskMatchesCrewId, resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { hasActivePlanningReturn } from "@/lib/tasks/planning-return"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

import {
  isTaskInDynamicPlanningPool,
  isTaskReopenableForPlanning,
  listReopenableDynamicPlanningTaskIdsForCrew,
} from "@/lib/planificacion/planning-dynamic"
import type { PlanningFilters } from "@/lib/planificacion/planning-utils"

export type CrewPlanningStatus = "editable" | "planned"

export type CrewPlanningButtonVisibility = {
  showPlanificar: boolean
  showReplanificar: boolean
  showPlannedBadge: boolean
}

/** OT en el circuito de planificación dinámica (aún no comenzaron). */
export function filterPlanningSessionTasks(
  tasks: Task[],
  filters: PlanningFilters
): Task[] {
  return tasks.filter((task) => {
    if (!isWorkOrderTask(task) || task.dueDate !== filters.date) {
      return false
    }

    if (hasActivePlanningReturn(task)) {
      return false
    }

    return isTaskInDynamicPlanningPool(task.status)
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

export function resolveCrewPlanningButtonVisibility(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): CrewPlanningButtonVisibility | null {
  const crewTasks = listPlanningSessionTasksForCrew(tasks, date, crew)

  if (crewTasks.length === 0) {
    return null
  }

  const hasProgrammed = crewTasks.some((task) => task.status === "programada")
  const hasReopenable = crewTasks.some(isTaskReopenableForPlanning)

  return {
    showPlanificar: hasProgrammed,
    showReplanificar: !hasProgrammed && hasReopenable,
    showPlannedBadge: false,
  }
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
  return listReopenableDynamicPlanningTaskIdsForCrew(tasks, date, crew)
}

export function isTaskPlanningEditable(task: Pick<Task, "status">): boolean {
  return task.status === "programada" || task.status === "asignada"
}

export function isJourneyFullyPlanned(
  tasks: Task[],
  date: string,
  activeCrews: Crew[]
): boolean {
  const sessionTasks = filterPlanningSessionTasks(tasks, { date })
  const hasUnassignedProgramada = sessionTasks.some(
    (task) =>
      task.status === "programada" &&
      !resolveTaskCrewId(task, activeCrews)
  )

  if (hasUnassignedProgramada) {
    return false
  }

  const crewsWithTasks = listActiveCrewsWithPlanningTasks(tasks, date, activeCrews)

  if (crewsWithTasks.length === 0) {
    return false
  }

  return crewsWithTasks.every((crew) => isCrewPlanningComplete(tasks, date, crew))
}

export {
  filterPlanningOperationalViewTasks,
  isTaskReopenableForPlanning,
} from "@/lib/planificacion/planning-dynamic"
