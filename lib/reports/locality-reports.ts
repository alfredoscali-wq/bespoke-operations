import { applyReportFilters, type ReportFilters } from "@/lib/reports/report-filters"
import type { Task } from "@/lib/types/tasks"

export type LocalityReportRow = {
  locality: string
  count: number
}

export function getLocalityReport(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = []
): LocalityReportRow[] {
  const filteredTasks = applyReportFilters(tasks, filters, crews)
  const counts = new Map<string, number>()

  for (const task of filteredTasks) {
    const locality = task.locality?.trim()
    if (!locality) {
      continue
    }

    counts.set(locality, (counts.get(locality) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([locality, count]) => ({ locality, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return left.locality.localeCompare(right.locality, "es")
    })
}
