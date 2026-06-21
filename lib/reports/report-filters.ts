import { compareDateOnly, isDateOnly } from "@/lib/dates/date-only"
import { taskMatchesCrewFilter } from "@/lib/tasks/crew-relation"
import type { Task } from "@/lib/types/tasks"

import {
  extractDatePortion,
  resolveReportPeriodRange,
  type ReportPeriodRange,
} from "@/lib/reports/report-utils"

export type ReportPeriod =
  | "today"
  | "week"
  | "month"
  | "last30"
  | "custom"

export type ReportFilters = {
  period: ReportPeriod
  startDate?: string
  endDate?: string
  crewId?: string
  serviceType?: string
  locality?: string
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  period: "month",
  crewId: undefined,
  serviceType: undefined,
  locality: undefined,
}

export function isDateWithinReportRange(
  value: string | null | undefined,
  range: ReportPeriodRange
): boolean {
  const date = extractDatePortion(value)
  if (!date) {
    return false
  }

  return (
    compareDateOnly(date, range.startDate) >= 0 &&
    compareDateOnly(date, range.endDate) <= 0
  )
}

function matchesDimensionFilters(
  task: Task,
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[]
): boolean {
  if (filters.crewId && !taskMatchesCrewFilter(task, filters.crewId, crews)) {
    return false
  }

  if (filters.serviceType && task.serviceType !== filters.serviceType) {
    return false
  }

  if (filters.locality) {
    const taskLocality = task.locality?.trim().toLocaleLowerCase("es") ?? ""
    const filterLocality = filters.locality.trim().toLocaleLowerCase("es")
    if (taskLocality !== filterLocality) {
      return false
    }
  }

  return true
}

function matchesPeriodFilter(task: Task, range: ReportPeriodRange): boolean {
  const dueDateInRange = isDateWithinReportRange(task.dueDate, range)
  const completedInRange = isDateWithinReportRange(task.completedAt, range)

  return dueDateInRange || completedInRange
}

export function applyReportFilters(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = []
): Task[] {
  const range = resolveReportPeriodRange(filters)

  if (
    filters.period === "custom" &&
    (!range.startDate ||
      !range.endDate ||
      !isDateOnly(range.startDate) ||
      !isDateOnly(range.endDate))
  ) {
    return []
  }

  return tasks.filter(
    (task) =>
      matchesDimensionFilters(task, filters, crews) &&
      matchesPeriodFilter(task, range)
  )
}

export function getReportLocalityOptions(tasks: Task[]): string[] {
  const localities = new Set<string>()

  for (const task of tasks) {
    const locality = task.locality?.trim()
    if (locality) {
      localities.add(locality)
    }
  }

  return Array.from(localities).sort((left, right) =>
    left.localeCompare(right, "es")
  )
}
