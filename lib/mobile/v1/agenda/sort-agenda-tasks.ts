import type { Task, TaskPriority } from "@/lib/types/tasks"

import {
  compareTasksByDispatchRoute,
  sortTasksByDispatchRoute,
  tasksHavePersistedDispatchOrder,
} from "@/lib/tasks/dispatch-order"

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  alta: 0,
  media: 1,
  baja: 2,
}

function compareScheduledTime(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const normalizedLeft = left?.trim() || "99:99"
  const normalizedRight = right?.trim() || "99:99"
  return normalizedLeft.localeCompare(normalizedRight)
}

function isAgendaObraTask(task: Pick<Task, "projectId">): boolean {
  return Boolean(task.projectId?.trim())
}

function sortRouteAgendaTasks(tasks: Task[]): Task[] {
  if (tasksHavePersistedDispatchOrder(tasks)) {
    return sortTasksByDispatchRoute(tasks)
  }

  return [...tasks].sort((left, right) => {
    const byRoute = compareTasksByDispatchRoute(left, right)
    if (byRoute !== 0) {
      return byRoute
    }

    const byTime = compareScheduledTime(left.scheduledTime, right.scheduledTime)
    if (byTime !== 0) {
      return byTime
    }

    const byPriority =
      PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
    if (byPriority !== 0) {
      return byPriority
    }

    const leftCreated = left.createdAt ?? ""
    const rightCreated = right.createdAt ?? ""
    return leftCreated.localeCompare(rightCreated)
  })
}

function sortObraAgendaTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const byName = (left.projectName ?? "").localeCompare(
      right.projectName ?? "",
      "es"
    )
    if (byName !== 0) return byName
    return left.code.localeCompare(right.code, "es")
  })
}

/**
 * OPS 2.1B: Obras first (no route order), then operational jornada by dispatch route.
 */
export function sortAgendaTasks(tasks: Task[]): Task[] {
  const obras = tasks.filter(isAgendaObraTask)
  const route = tasks.filter((task) => !isAgendaObraTask(task))
  return [...sortObraAgendaTasks(obras), ...sortRouteAgendaTasks(route)]
}
