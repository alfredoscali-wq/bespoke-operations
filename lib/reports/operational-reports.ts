import {
  applyReportFilters,
  isDateWithinReportRange,
  type ReportFilters,
} from "@/lib/reports/report-filters"
import {
  calculateComplianceRate,
  resolveReportPeriodRange,
} from "@/lib/reports/report-utils"
import type { Task } from "@/lib/types/tasks"

export type OperationalReportSummary = {
  programmed: number
  completed: number
  cancelled: number
  compliance: number
}

export function getOperationalReportSummary(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = []
): OperationalReportSummary {
  const filteredTasks = applyReportFilters(tasks, filters, crews)
  const range = resolveReportPeriodRange(filters)

  const programmed = filteredTasks.filter((task) =>
    isDateWithinReportRange(task.dueDate, range)
  ).length

  const completed = filteredTasks.filter(
    (task) =>
      Boolean(task.completedAt) &&
      isDateWithinReportRange(task.completedAt, range)
  ).length

  const cancelled = filteredTasks.filter(
    (task) =>
      task.status === "cancelada" &&
      isDateWithinReportRange(task.dueDate, range)
  ).length

  return {
    programmed,
    completed,
    cancelled,
    compliance: calculateComplianceRate(completed, programmed),
  }
}
