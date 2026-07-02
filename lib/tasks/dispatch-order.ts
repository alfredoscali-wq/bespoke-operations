import { compareDateOnly } from "@/lib/dates/date-only"
import { filterOperationalOrderScope } from "@/lib/planificacion/planning-operational-order-core"
import { resolveOperationalOrderValue } from "@/lib/planificacion/planning-operational-order-core"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

type CrewRef = Pick<Crew, "id" | "name">

const CIRCLED_NUMBER_MAX = 20

export {
  buildDispatchOrderAssignmentUpdates,
  buildDispatchOrderConfirmUpdates,
  dedupeDispatchOrderUpdates,
  type DispatchOrderUpdate,
} from "@/lib/planificacion/planning-dispatch-order"

export function resolveTaskRouteOrder(
  task: Pick<Task, "dispatchOrder" | "executionOrder">
): number | null {
  return resolveOperationalOrderValue(task)
}

export function hasTaskRouteOrder(
  task: Pick<Task, "dispatchOrder" | "executionOrder">
): boolean {
  return resolveTaskRouteOrder(task) != null
}

export function tasksHavePersistedDispatchOrder(
  tasks: Pick<Task, "dispatchOrder">[]
): boolean {
  return tasks.some(
    (task) => task.dispatchOrder != null && task.dispatchOrder > 0
  )
}

export function formatDispatchOrderBadge(
  order: number | null | undefined
): string | null {
  if (order == null || order <= 0 || !Number.isFinite(order)) {
    return null
  }

  const normalized = Math.floor(order)
  if (normalized >= 1 && normalized <= CIRCLED_NUMBER_MAX) {
    return String.fromCodePoint(0x2460 + normalized - 1)
  }

  return `Ruta #${normalized}`
}

export function formatDispatchOrderNumericLabel(
  order: number | null | undefined
): string | null {
  if (order == null || order <= 0 || !Number.isFinite(order)) {
    return null
  }

  return String(Math.floor(order))
}

function resolveCrewSortLabel(
  task: Task,
  crews: CrewRef[] = []
): string {
  return (
    task.crew?.trim() ||
    crews.find((crew) => crew.id === resolveTaskCrewId(task, crews))?.name ||
    ""
  )
}

function compareRouteOrderValues(
  left: number | null,
  right: number | null
): number {
  const leftHas = left != null && left > 0
  const rightHas = right != null && right > 0

  if (leftHas && rightHas) {
    return left! - right!
  }

  if (leftHas !== rightHas) {
    return leftHas ? -1 : 1
  }

  return 0
}

export function compareTasksByDispatchRoute(
  left: Task,
  right: Task,
  crews: CrewRef[] = []
): number {
  const byDate = compareDateOnly(left.dueDate, right.dueDate)
  if (byDate !== 0) {
    return byDate
  }

  const byCrew = resolveCrewSortLabel(left, crews).localeCompare(
    resolveCrewSortLabel(right, crews),
    "es"
  )
  if (byCrew !== 0) {
    return byCrew
  }

  const byRoute = compareRouteOrderValues(
    resolveTaskRouteOrder(left),
    resolveTaskRouteOrder(right)
  )
  if (byRoute !== 0) {
    return byRoute
  }

  if (
    tasksHavePersistedDispatchOrder([left, right]) ||
    hasTaskRouteOrder(left) ||
    hasTaskRouteOrder(right)
  ) {
    return 0
  }

  return (left.createdAt ?? "").localeCompare(right.createdAt ?? "")
}

export function sortTasksByDispatchRoute(
  tasks: Task[],
  crews: CrewRef[] = []
): Task[] {
  return [...tasks].sort((left, right) =>
    compareTasksByDispatchRoute(left, right, crews)
  )
}

export function filterTasksInDispatchScope(
  tasks: Task[],
  dueDate: string,
  crewId: string | null | undefined,
  crews: CrewRef[] = []
): Task[] {
  return filterOperationalOrderScope(tasks, dueDate, crewId, crews)
}

export {
  filterOperationalOrderScope,
  isOperationalOrderReorderable,
  resolveOperationalOrderValue,
} from "@/lib/planificacion/planning-operational-order-core"
