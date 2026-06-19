import { toDateOnly } from "@/lib/availability/utils"
import { isFinalTaskStatus } from "@/lib/tasks/status-groups"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export type CriticalPendingTask = {
  taskId: string
  code: string
  title: string
  projectId?: string
  projectCode: string
  projectName: string
  crewName: string
  dueDate: string
  status: TaskStatus
}

export function isCriticalPendingTask(
  task: Task,
  referenceDate: string = toDateOnly()
): boolean {
  return !isFinalTaskStatus(task.status) && task.dueDate < referenceDate
}

export function getCriticalPendingTasks(
  tasks: Task[],
  options: { referenceDate?: string; projectId?: string | null } = {}
): CriticalPendingTask[] {
  const referenceDate = options.referenceDate ?? toDateOnly()

  return tasks
    .filter((task) => {
      if (!isCriticalPendingTask(task, referenceDate)) {
        return false
      }

      if (options.projectId && task.projectId !== options.projectId) {
        return false
      }

      return true
    })
    .map((task) => ({
      taskId: task.id,
      code: task.code,
      title: task.title,
      projectId: task.projectId,
      projectCode: task.projectCode,
      projectName: task.projectName,
      crewName: task.crew || "—",
      dueDate: task.dueDate,
      status: task.status,
    }))
    .sort((a, b) => {
      const byDueDate = a.dueDate.localeCompare(b.dueDate)
      if (byDueDate !== 0) {
        return byDueDate
      }

      return a.code.localeCompare(b.code, "es")
    })
}
