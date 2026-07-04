import { isTaskArchivedStatus } from "@/lib/tasks/task-archived-status"
import { isDateWithinReportRange } from "@/lib/reports/report-filters"
import type { ReportPeriodRange } from "@/lib/reports/report-utils"
import type { Task } from "@/lib/types/tasks"

export function isTaskCompletedForReporting(
  task: Pick<Task, "status">
): boolean {
  return isTaskArchivedStatus(task.status)
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
