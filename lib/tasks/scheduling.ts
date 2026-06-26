import { compareDateOnly } from "@/lib/dates/date-only"
import type { Task } from "@/lib/types/tasks"

const DEFAULT_SCHEDULED_TIME = "08:00"
const TIME_INPUT_PATTERN = /^(\d{2}):(\d{2})$/
const TIME_DB_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Fecha programada operativa (due_date como scheduled_date). */
export function getTaskScheduledDate(task: Pick<Task, "dueDate">): string {
  return task.dueDate
}

export function getDefaultScheduledTime(): string {
  return DEFAULT_SCHEDULED_TIME
}

export function normalizeScheduledTimeForDb(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const inputMatch = trimmed.match(TIME_INPUT_PATTERN)
  if (inputMatch) {
    return `${inputMatch[1]}:${inputMatch[2]}:00`
  }

  const dbMatch = trimmed.match(TIME_DB_PATTERN)
  if (dbMatch) {
    return `${dbMatch[1]}:${dbMatch[2]}:${dbMatch[3] ?? "00"}`
  }

  return null
}

export function formatScheduledTimeForInput(
  value: string | null | undefined
): string {
  const trimmed = value?.trim()
  if (!trimmed) return ""

  const match = trimmed.match(TIME_DB_PATTERN)
  if (!match) return trimmed.slice(0, 5)

  return `${match[1]}:${match[2]}`
}

export function formatScheduledTimeDisplay(
  value: string | null | undefined
): string | null {
  const formatted = formatScheduledTimeForInput(value)
  return formatted || null
}

function scheduledTimeSortKey(value: string | null | undefined): string {
  const normalized = formatScheduledTimeForInput(value)
  return normalized || "99:99"
}

export function compareTasksBySchedule(left: Task, right: Task): number {
  const byDate = compareDateOnly(left.dueDate, right.dueDate)
  if (byDate !== 0) return byDate

  return scheduledTimeSortKey(left.scheduledTime).localeCompare(
    scheduledTimeSortKey(right.scheduledTime)
  )
}

export function compareScheduledTimeStrings(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  return scheduledTimeSortKey(left).localeCompare(scheduledTimeSortKey(right))
}
