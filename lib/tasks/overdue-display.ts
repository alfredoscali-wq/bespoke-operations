import { compareDateOnly, formatDateOnly, toLocalDateOnly } from "@/lib/dates/date-only"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { isTaskVencida } from "@/lib/tasks/vencida-status"
import type { Task } from "@/lib/types/tasks"

export type OverdueTaskSummary = {
  scheduledDateLabel: string
  overdueDays: number
  overdueDaysLabel: string
  statusLabel: string
  crewLabel: string
  supervisorLabel: string
}

export function computeOverdueDays(
  task: Pick<Task, "dueDate" | "status">,
  referenceDate: Date = new Date()
): number | null {
  if (!isTaskVencida(task)) {
    return null
  }

  const dueDate = task.dueDate?.trim()
  if (!dueDate) {
    return null
  }

  const today = toLocalDateOnly(referenceDate)
  const diff = compareDateOnly(today, dueDate)

  return diff > 0 ? diff : 1
}

export function formatOverdueDaysLabel(days: number): string {
  if (days === 1) {
    return "Vencida hace 1 día"
  }

  return `Vencida hace ${days} días`
}

export function buildOverdueTaskSummary(task: Task): OverdueTaskSummary | null {
  const overdueDays = computeOverdueDays(task)
  if (overdueDays == null) {
    return null
  }

  return {
    scheduledDateLabel: formatDateOnly(task.dueDate),
    overdueDays,
    overdueDaysLabel: formatOverdueDaysLabel(overdueDays),
    statusLabel: TASK_STATUS_LABELS[task.status],
    crewLabel: task.crew?.trim() || "Sin cuadrilla asignada",
    supervisorLabel: task.supervisor?.trim() || "—",
  }
}
