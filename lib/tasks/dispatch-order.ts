import { compareDateOnly } from "@/lib/dates/date-only"
import { resolveTaskCrewId, taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

type CrewRef = Pick<Crew, "id" | "name">

const CIRCLED_NUMBER_MAX = 20

export type DispatchOrderUpdate = {
  taskId: string
  dispatchOrder: number | null
}

export function resolveTaskRouteOrder(
  task: Pick<Task, "dispatchOrder" | "executionOrder">
): number | null {
  const dispatch = task.dispatchOrder
  if (dispatch != null && dispatch > 0 && Number.isFinite(dispatch)) {
    return Math.floor(dispatch)
  }

  const execution = task.executionOrder
  if (execution != null && execution > 0 && Number.isFinite(execution)) {
    return Math.floor(execution)
  }

  return null
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

export function buildDispatchOrderConfirmUpdates(
  tasks: Task[],
  taskIds: string[],
  crews: CrewRef[] = []
): DispatchOrderUpdate[] {
  const idSet = new Set(taskIds)
  const scoped = tasks.filter((task) => idSet.has(task.id))
  const groups = new Map<string, Task[]>()

  for (const task of scoped) {
    const crewId = resolveTaskCrewId(task, crews)
    if (!crewId) {
      continue
    }

    const key = `${task.dueDate}::${crewId}`
    const bucket = groups.get(key) ?? []
    bucket.push(task)
    groups.set(key, bucket)
  }

  const updates: DispatchOrderUpdate[] = []

  for (const groupTasks of groups.values()) {
    const ordered = sortTasksByDispatchRoute(groupTasks, crews)

    ordered.forEach((task, index) => {
      const nextOrder = index + 1
      if (task.dispatchOrder !== nextOrder) {
        updates.push({ taskId: task.id, dispatchOrder: nextOrder })
      }
    })
  }

  for (const task of scoped) {
    if (!resolveTaskCrewId(task, crews) && task.dispatchOrder != null) {
      updates.push({ taskId: task.id, dispatchOrder: null })
    }
  }

  return dedupeDispatchOrderUpdates(updates)
}

export function dedupeDispatchOrderUpdates(
  updates: DispatchOrderUpdate[]
): DispatchOrderUpdate[] {
  const byTaskId = new Map<string, DispatchOrderUpdate>()
  for (const update of updates) {
    byTaskId.set(update.taskId, update)
  }
  return [...byTaskId.values()]
}

export function filterTasksInDispatchScope(
  tasks: Task[],
  dueDate: string,
  crewId: string | null | undefined,
  crews: CrewRef[] = []
): Task[] {
  if (!crewId) {
    return []
  }

  return tasks.filter(
    (task) =>
      task.dueDate === dueDate &&
      taskMatchesCrewId(task, { id: crewId, name: "" })
  )
}
