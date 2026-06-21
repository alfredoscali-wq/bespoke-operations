import { applyReportFilters, type ReportFilters } from "@/lib/reports/report-filters"
import {
  WORK_ORDER_SERVICE_TYPE_LABELS,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

export type ServiceTypeReportRow = {
  serviceType: string
  label: string
  count: number
}

function resolveServiceTypeLabel(serviceType: string): string {
  return (
    WORK_ORDER_SERVICE_TYPE_LABELS[serviceType as WorkOrderServiceType] ??
    serviceType
  )
}

export function getServiceTypeReport(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = []
): ServiceTypeReportRow[] {
  const filteredTasks = applyReportFilters(tasks, filters, crews)
  const counts = new Map<string, number>()

  for (const task of filteredTasks) {
    const serviceType = task.serviceType?.trim()
    if (!serviceType) {
      continue
    }

    counts.set(serviceType, (counts.get(serviceType) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([serviceType, count]) => ({
      serviceType,
      label: resolveServiceTypeLabel(serviceType),
      count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return left.label.localeCompare(right.label, "es")
    })
}
