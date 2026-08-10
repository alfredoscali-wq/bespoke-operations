/**
 * OPS 2.1A — Multi-day OT projection in Planificación Operativa.
 * One DB row; presence on every calendar day in [startDate, dueDate].
 */

import { compareDateOnly, formatDateOnly, parseDateOnlyForDisplay } from "@/lib/dates/date-only"
import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"
import { resolveMinutesForWorkDate } from "@/lib/projects/task-daily-allocations"
import type { Task } from "@/lib/types/tasks"

export type PlanningDateRangeTask = Pick<Task, "dueDate"> &
  Partial<Pick<Task, "startDate" | "estimatedDuration" | "dailyAllocations">>

/** start_date if set; otherwise due_date. */
export function resolvePlanningRangeStartDate(
  task: PlanningDateRangeTask
): string {
  const start = task.startDate?.trim()
  if (start) {
    return start
  }

  return task.dueDate?.trim() ?? ""
}

/**
 * True when planningDate falls in [start_date, due_date] (inclusive).
 * Missing start_date → start = due_date (single-day).
 */
export function isTaskActiveOnPlanningDate(
  task: PlanningDateRangeTask,
  planningDate: string
): boolean {
  const date = planningDate.trim()
  const due = task.dueDate?.trim() ?? ""
  if (!date || !due) {
    return false
  }

  const start = resolvePlanningRangeStartDate(task)
  if (!start) {
    return false
  }

  return (
    compareDateOnly(start, date) <= 0 && compareDateOnly(date, due) <= 0
  )
}

/** Inclusive calendar days between start and due (minimum 1). */
export function resolvePlanningSpanDays(task: PlanningDateRangeTask): number {
  const start = resolvePlanningRangeStartDate(task)
  const due = task.dueDate?.trim() ?? ""
  if (!start || !due) {
    return 1
  }

  if (compareDateOnly(due, start) < 0) {
    return 1
  }

  const startMs = parseDateOnlyForDisplay(start).getTime()
  const dueMs = parseDateOnlyForDisplay(due).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(dueMs)) {
    return 1
  }

  const days = Math.floor((dueMs - startMs) / 86_400_000) + 1
  return Math.max(1, days)
}

/**
 * 1-based day index within the OT range for planningDate.
 * Null when the OT is not active on that date.
 */
export function resolvePlanningDayIndex(
  task: PlanningDateRangeTask,
  planningDate: string
): number | null {
  if (!isTaskActiveOnPlanningDate(task, planningDate)) {
    return null
  }

  const start = resolvePlanningRangeStartDate(task)
  const startMs = parseDateOnlyForDisplay(start).getTime()
  const dayMs = parseDateOnlyForDisplay(planningDate.trim()).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(dayMs)) {
    return null
  }

  const index = Math.floor((dayMs - startMs) / 86_400_000) + 1
  const span = resolvePlanningSpanDays(task)
  if (index < 1 || index > span) {
    return null
  }

  return index
}

/**
 * Daily load for KPIs / capacity.
 * OPS 2.6: when task.dailyAllocations exist, use allocated minutes for the day.
 * Otherwise: even-split totalMinutes / spanDays (legacy).
 */
export function resolvePlanningDayDurationMinutes(
  task: PlanningDateRangeTask,
  planningDate: string
): number {
  if (!isTaskActiveOnPlanningDate(task, planningDate)) {
    return 0
  }

  const allocated = resolveMinutesForWorkDate(
    task.dailyAllocations,
    planningDate.trim()
  )
  if (allocated != null) {
    return allocated
  }

  const totalMinutes = parseEstimatedDurationMinutes(
    task.estimatedDuration ?? ""
  )
  if (totalMinutes <= 0) {
    return 0
  }

  const spanDays = resolvePlanningSpanDays(task)
  if (spanDays <= 1) {
    return totalMinutes
  }

  const base = Math.floor(totalMinutes / spanDays)
  const remainder = totalMinutes % spanDays
  const dayIndex = resolvePlanningDayIndex(task, planningDate)
  if (dayIndex == null) {
    return 0
  }

  // Remainder minutes land on the last `remainder` days of the span.
  return base + (dayIndex > spanDays - remainder ? 1 : 0)
}

/** Badge label "Día X de Y", or null for single-day OT / inactive date. */
export function formatPlanningMultiDayBadge(
  task: PlanningDateRangeTask,
  planningDate: string
): string | null {
  const span = resolvePlanningSpanDays(task)
  if (span <= 1) {
    return null
  }

  const dayIndex = resolvePlanningDayIndex(task, planningDate)
  if (dayIndex == null) {
    return null
  }

  return `Día ${dayIndex} de ${span}`
}

/**
 * OPS 2.1B.1 — same date label as Planificación Obras:
 * single-day → "10 ago 2026"
 * multi-day → "08 ago 2026 → 10 ago 2026"
 */
export function formatPlanningTaskDateRangeLabel(
  task: PlanningDateRangeTask
): string {
  const due = task.dueDate?.trim() ?? ""
  if (!due) {
    return "—"
  }

  const start = resolvePlanningRangeStartDate(task)
  if (resolvePlanningSpanDays(task) <= 1 || !start || start === due) {
    return formatDateOnly(due)
  }

  return `${formatDateOnly(start)} → ${formatDateOnly(due)}`
}
