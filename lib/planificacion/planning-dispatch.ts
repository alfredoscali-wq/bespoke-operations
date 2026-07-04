import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Crew } from "@/lib/types/crews"
import type { Task, TaskStatus } from "@/lib/types/tasks"

import {
  type PlanningFilters,
} from "@/lib/planificacion/planning-utils"
import { sortTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import { isTaskArchivedStatus } from "@/lib/tasks/task-archived-status"

export type PlanningDispatchMode = "editing" | "confirmed"

/** OT excluidas de la planificación operativa (KPI, mapa, listado). */
export const PLANNING_EXCLUDED_TASK_STATUSES: TaskStatus[] = [
  "finalizada",
  "cancelada",
  "pendiente-cierre",
  "cerrada",
]

/** OT visibles en el centro de despacho para la jornada confirmada. */
export const CONFIRMED_DISPATCH_STATUSES: TaskStatus[] = [
  "asignada",
  "en-curso",
  "vencida",
  "incidencia",
  "en-aprobacion",
]

export function isPlanningOperationalTaskStatus(status: TaskStatus): boolean {
  return !PLANNING_EXCLUDED_TASK_STATUSES.includes(status)
}

export type PlanningDispatchKpis = {
  plannedCount: number
  pendingExecutionCount: number
  inProgressCount: number
  completedCount: number
  incidentsCount: number
}

export type PlanningCrewRoute = {
  crewId: string
  crewName: string
  tasks: Task[]
}

export function filterProgrammedTasksForPlanningDate(
  tasks: Task[],
  filters: PlanningFilters
): Task[] {
  return tasks.filter((task) => {
    if (!isWorkOrderTask(task) || task.status !== "programada") {
      return false
    }

    return task.dueDate === filters.date
  })
}

export function filterConfirmedDispatchTasksForPlanning(
  tasks: Task[],
  filters: PlanningFilters
): Task[] {
  return tasks.filter((task) => {
    if (!isWorkOrderTask(task)) {
      return false
    }

    if (task.dueDate !== filters.date) {
      return false
    }

    return CONFIRMED_DISPATCH_STATUSES.includes(task.status)
  })
}

export function resolvePlanningDispatchMode(
  tasks: Task[],
  date: string
): PlanningDispatchMode {
  const programmed = filterProgrammedTasksForPlanningDate(tasks, { date })
  if (programmed.length > 0) {
    return "editing"
  }

  const dispatched = filterConfirmedDispatchTasksForPlanning(tasks, { date })
  if (dispatched.length > 0) {
    return "confirmed"
  }

  return "editing"
}

export function listReopenablePlanningTaskIds(
  tasks: Task[],
  date: string
): string[] {
  return filterConfirmedDispatchTasksForPlanning(tasks, { date })
    .filter(
      (task) => task.status === "asignada" || task.status === "vencida"
    )
    .map((task) => task.id)
}

export function computePlanningDispatchKpis(
  tasks: Task[]
): PlanningDispatchKpis {
  return {
    plannedCount: tasks.length,
    pendingExecutionCount: tasks.filter(
      (task) => task.status === "asignada" || task.status === "vencida"
    ).length,
    inProgressCount: tasks.filter((task) => task.status === "en-curso").length,
    completedCount: tasks.filter(
      (task) => isTaskArchivedStatus(task.status)
    ).length,
    incidentsCount: tasks.filter((task) => task.status === "incidencia").length,
  }
}

export function buildPlanningCrewRoutes(
  tasks: Task[],
  crews: Crew[]
): PlanningCrewRoute[] {
  const routes: PlanningCrewRoute[] = []

  for (const crew of crews) {
    const crewTasks = tasks.filter((task) => taskMatchesCrewId(task, crew))
    if (crewTasks.length === 0) {
      continue
    }

    routes.push({
      crewId: crew.id,
      crewName: crew.name,
      tasks: sortTasksByDispatchRoute(crewTasks, crews),
    })
  }

  const unassignedTasks = tasks.filter(
    (task) =>
      !crews.some((crew) => taskMatchesCrewId(task, crew)) &&
      !task.crewId?.trim() &&
      !task.crew?.trim()
  )

  if (unassignedTasks.length > 0) {
    routes.push({
      crewId: "__unassigned__",
      crewName: "Sin cuadrilla",
      tasks: sortTasksByDispatchRoute(unassignedTasks, crews),
    })
  }

  const orphanNamedTasks = tasks.filter(
    (task) =>
      !crews.some((crew) => taskMatchesCrewId(task, crew)) &&
      Boolean(task.crew?.trim())
  )

  if (orphanNamedTasks.length > 0) {
    const byName = new Map<string, Task[]>()
    for (const task of orphanNamedTasks) {
      const name = task.crew!.trim()
      const bucket = byName.get(name) ?? []
      bucket.push(task)
      byName.set(name, bucket)
    }

    for (const [crewName, bucket] of byName) {
      routes.push({
        crewId: `name:${crewName}`,
        crewName,
        tasks: sortTasksByDispatchRoute(bucket, crews),
      })
    }
  }

  return routes.sort((left, right) =>
    left.crewName.localeCompare(right.crewName, "es")
  )
}
