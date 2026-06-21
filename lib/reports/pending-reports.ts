import { compareDateOnly } from "@/lib/dates/date-only"
import { applyReportFilters, type ReportFilters } from "@/lib/reports/report-filters"
import { extractDatePortion, toDateOnlyString } from "@/lib/reports/report-utils"
import {
  WORK_ORDER_SERVICE_TYPE_LABELS,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

export type OldestPendingTaskRow = {
  taskId: string
  customer: string
  serviceTypeLabel: string
  scheduledDate: string
  pendingDays: number
}

const MAX_OLDEST_PENDING_ROWS = 10

function isPendingTask(task: Task): boolean {
  if (task.status === "cancelada") {
    return false
  }

  return task.status !== "finalizada" && task.status !== "cerrada"
}

function resolveCustomerName(task: Task): string {
  return (
    task.customerName?.trim() ||
    task.projectName?.trim() ||
    task.title?.trim() ||
    "—"
  )
}

function resolveServiceTypeLabel(task: Task): string {
  const serviceType = task.serviceType?.trim()
  if (!serviceType) {
    return "Sin tipo"
  }

  return (
    WORK_ORDER_SERVICE_TYPE_LABELS[serviceType as WorkOrderServiceType] ??
    serviceType
  )
}

export function calculatePendingDays(
  dueDate: string | null | undefined,
  referenceDate = new Date()
): number {
  const due = extractDatePortion(dueDate)
  if (!due) {
    return 0
  }

  const today = toDateOnlyString(referenceDate)
  return compareDateOnly(today, due)
}

export function getOldestPendingTasks(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = [],
  referenceDate = new Date()
): OldestPendingTaskRow[] {
  const filteredTasks = applyReportFilters(tasks, filters, crews)

  return filteredTasks
    .filter(isPendingTask)
    .map((task) => ({
      taskId: task.id,
      customer: resolveCustomerName(task),
      serviceTypeLabel: resolveServiceTypeLabel(task),
      scheduledDate: task.dueDate,
      pendingDays: calculatePendingDays(task.dueDate, referenceDate),
    }))
    .sort((left, right) => {
      if (right.pendingDays !== left.pendingDays) {
        return right.pendingDays - left.pendingDays
      }

      return compareDateOnly(left.scheduledDate, right.scheduledDate)
    })
    .slice(0, MAX_OLDEST_PENDING_ROWS)
}
