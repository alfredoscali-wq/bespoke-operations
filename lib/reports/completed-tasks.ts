import { isDateWithinReportRange } from "@/lib/reports/report-filters"
import type { ReportPeriodRange } from "@/lib/reports/report-utils"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export const REPORT_COMPLETED_TASK_STATUSES = [
  "finalizada",
  "cerrada",
] as const satisfies readonly TaskStatus[]

const REPORT_COMPLETED_STATUS_SET = new Set<TaskStatus>(
  REPORT_COMPLETED_TASK_STATUSES
)

export function isTaskCompletedForReporting(
  task: Pick<Task, "status">
): boolean {
  return REPORT_COMPLETED_STATUS_SET.has(task.status)
}

export function isTaskCompletedInReportRange(
  task: Pick<Task, "status" | "completedAt">,
  range: ReportPeriodRange
): boolean {
  return (
    isTaskCompletedForReporting(task) &&
    Boolean(task.completedAt) &&
    isDateWithinReportRange(task.completedAt, range)
  )
}
