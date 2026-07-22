import { isTaskVencida } from "@/lib/tasks/vencida-status"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export type CriticalPendingTask = {
  taskId: string
  code: string
  title: string
  projectId?: string
  projectCode: string
  projectName: string
  crewName: string
  supervisorName: string
  dueDate: string
  status: TaskStatus
}

export function isCriticalPendingTask(task: Task): boolean {
  return isTaskVencida(task)
}

export function getCriticalPendingTasks(
  tasks: Task[],
  options: { projectId?: string | null } = {}
): CriticalPendingTask[] {
  return tasks
    .filter((task) => {
      if (!isCriticalPendingTask(task)) {
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
      supervisorName: task.supervisor?.trim() || "—",
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
