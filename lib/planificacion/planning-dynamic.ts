import { filterOperationalOrderScope } from "@/lib/planificacion/planning-operational-order-core"
import {
  resolveDispatchOperationalOrder,
  resolveOperationalOrderValue,
  resolvePlanningExecutionOrder,
} from "@/lib/planificacion/planning-operational-order-core"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Crew } from "@/lib/types/crews"
import type { Task, TaskStatus } from "@/lib/types/tasks"

import type { PlanningFilters } from "@/lib/planificacion/planning-utils"

type CrewRef = Pick<Crew, "id" | "name">

/** OT que participan de la planificación dinámica (aún no comenzaron). */
export const DYNAMIC_PLANNING_TASK_STATUSES = [
  "programada",
  "asignada",
  "vencida",
] as const satisfies readonly TaskStatus[]

/** OT con posición de ruta congelada; no vuelven a la planificación editable. */
export const PLANNING_ROUTE_FROZEN_STATUSES = [
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
] as const satisfies readonly TaskStatus[]

export function isTaskInDynamicPlanningPool(
  status: TaskStatus
): status is (typeof DYNAMIC_PLANNING_TASK_STATUSES)[number] {
  return DYNAMIC_PLANNING_TASK_STATUSES.includes(
    status as (typeof DYNAMIC_PLANNING_TASK_STATUSES)[number]
  )
}

export function isPlanningRouteFrozenTask(
  task: Pick<Task, "status">
): boolean {
  return PLANNING_ROUTE_FROZEN_STATUSES.includes(
    task.status as (typeof PLANNING_ROUTE_FROZEN_STATUSES)[number]
  )
}

export function isTaskReopenableForPlanning(
  task: Pick<Task, "status">
): boolean {
  return task.status === "asignada" || task.status === "vencida"
}

/** OT visibles en la vista operativa de planificación (editables + ruta congelada). */
export function filterPlanningOperationalViewTasks(
  tasks: Task[],
  filters: PlanningFilters
): Task[] {
  return tasks.filter((task) => {
    if (!isWorkOrderTask(task) || task.dueDate !== filters.date) {
      return false
    }

    return (
      isTaskInDynamicPlanningPool(task.status) ||
      isPlanningRouteFrozenTask(task)
    )
  })
}

export function listDynamicPlanningTasksForCrew(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): Task[] {
  return filterPlanningOperationalViewTasks(tasks, { date }).filter((task) =>
    taskMatchesCrewId(task, crew)
  )
}

export function listReopenableDynamicPlanningTaskIdsForCrew(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): string[] {
  return listDynamicPlanningTasksForCrew(tasks, date, crew)
    .filter(isTaskReopenableForPlanning)
    .map((task) => task.id)
}

export function collectFrozenPlanningRouteOrders(scope: Task[]): Set<number> {
  const frozenOrders = new Set<number>()

  for (const task of scope) {
    if (!isPlanningRouteFrozenTask(task)) {
      continue
    }

    const order = resolveDispatchOperationalOrder(task)
    if (order != null && order > 0) {
      frozenOrders.add(Math.floor(order))
    }
  }

  return frozenOrders
}

/** Órdenes de despacho ya ocupadas en la ruta (congeladas + operativas no en confirmación). */
export function collectOccupiedDispatchOrdersForConfirm(
  routeScope: Task[],
  confirmingTaskIds: ReadonlySet<string> | string[]
): Set<number> {
  const confirmingIds =
    confirmingTaskIds instanceof Set
      ? confirmingTaskIds
      : new Set(confirmingTaskIds)
  const occupied = collectFrozenPlanningRouteOrders(routeScope)

  for (const task of routeScope) {
    if (confirmingIds.has(task.id)) {
      continue
    }

    const order = resolveDispatchOperationalOrder(task)
    if (order != null && order > 0) {
      occupied.add(Math.floor(order))
    }
  }

  return occupied
}

/** Siguiente posición al final de la cola vigente (execution + dispatch), respetando OT congeladas. */
export function resolveNextPlanningQueuePosition(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  crews?: CrewRef[]
  excludeTaskId?: string
}): number {
  const { tasks, dueDate, crewId, crews = [], excludeTaskId } = input
  const routeScope = filterOperationalOrderScope(
    tasks,
    dueDate,
    crewId,
    crews
  ).filter((task) => task.id !== excludeTaskId)

  const maxOrder = routeScope.reduce((max, task) => {
    if (
      !isTaskInDynamicPlanningPool(task.status) &&
      !isPlanningRouteFrozenTask(task)
    ) {
      return max
    }

    const order = resolveOperationalOrderValue(task)
    return Math.max(max, order ?? 0)
  }, 0)

  return maxOrder + 1
}

export function resolvePlanningQueueOrderForTask(
  task: Pick<Task, "status" | "executionOrder" | "dispatchOrder">
): number | null {
  if (task.status === "programada") {
    return resolvePlanningExecutionOrder(task)
  }

  return resolveDispatchOperationalOrder(task)
}
