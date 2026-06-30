import type { Task, TaskPriority } from "@/lib/types/tasks"

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

export function sortAgendaTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
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
