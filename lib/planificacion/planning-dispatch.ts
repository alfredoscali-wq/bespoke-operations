import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Crew } from "@/lib/types/crews"
import type { Task, TaskStatus } from "@/lib/types/tasks"

import {
  parseEstimatedDurationMinutes,
  type PlanningFilters,
} from "@/lib/planificacion/planning-utils"
import { sortTasksForPlanningList } from "@/lib/planificacion/planning-execution-order"

export type PlanningDispatchMode = "editing" | "confirmed"

/** OT visibles en el centro de despacho una vez confirmada la jornada. */
export const CONFIRMED_DISPATCH_STATUSES: TaskStatus[] = [
  "asignada",
  "en-curso",
  "vencida",
  "incidencia",
]

export type PlanningDispatchKpis = {
  plannedCount: number
  crewsInvolvedCount: number
  unassignedCount: number
  pendingCount: number
  incidentsCount: number
  estimatedHours: number
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
    .filter((task) => task.status === "asignada")
    .map((task) => task.id)
}

function countCrewsInvolved(tasks: Task[], crews: Crew[]): number {
  const crewIds = new Set<string>()

  for (const crew of crews) {
    if (tasks.some((task) => taskMatchesCrewId(task, crew))) {
      crewIds.add(crew.id)
    }
  }

  for (const task of tasks) {
    const crewName = task.crew?.trim()
    if (crewName && !task.crewId?.trim()) {
      crewIds.add(`name:${crewName}`)
    }
  }

  return crewIds.size
}

export function computePlanningDispatchKpis(
  tasks: Task[],
  crews: Crew[],
  mode: PlanningDispatchMode
): PlanningDispatchKpis {
  const totalMinutes = tasks.reduce(
    (sum, task) => sum + parseEstimatedDurationMinutes(task.estimatedDuration),
    0
  )

  const unassignedCount = tasks.filter(
    (task) => !task.crewId?.trim() && !task.crew?.trim()
  ).length

  const incidentsCount = tasks.filter((task) => task.status === "incidencia").length

  const pendingCount =
    mode === "editing"
      ? tasks.length
      : tasks.filter((task) => task.status === "asignada").length

  return {
    plannedCount: tasks.length,
    crewsInvolvedCount: countCrewsInvolved(tasks, crews),
    unassignedCount,
    pendingCount,
    incidentsCount,
    estimatedHours: totalMinutes / 60,
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
      tasks: sortTasksForPlanningList(crewTasks, crews),
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
      tasks: sortTasksForPlanningList(unassignedTasks, crews),
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
        tasks: sortTasksForPlanningList(bucket, crews),
      })
    }
  }

  return routes.sort((left, right) =>
    left.crewName.localeCompare(right.crewName, "es")
  )
}
