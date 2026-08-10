/**
 * OPS 2.6 — daily minute allocations for multi-day Obra OTs.
 * Empty allocations → planning uses even split of estimatedDuration.
 */

import { compareDateOnly, parseDateOnlyForDisplay } from "@/lib/dates/date-only"
import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"
import { formatDateOnly } from "@/lib/dates/date-only"

export type TaskDailyAllocationDraft = {
  workDate: string
  allocatedMinutes: number
}

export type TaskDailyAllocationMode = "automatic" | "manual"

export const DAILY_ALLOCATION_SUM_MISMATCH_MESSAGE =
  "La distribución diaria debe coincidir con la duración total de la OT."

/** Inclusive YYYY-MM-DD list from start to due. */
export function listWorkDatesInRange(
  startDate: string,
  dueDate: string
): string[] {
  const start = startDate.trim()
  const due = dueDate.trim()
  if (!start || !due || compareDateOnly(due, start) < 0) {
    return start ? [start] : []
  }

  const dates: string[] = []
  let cursor = parseDateOnlyForDisplay(start)
  const end = parseDateOnlyForDisplay(due)
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(end.getTime())) {
    return [start]
  }

  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, "0")
    const d = String(cursor.getDate()).padStart(2, "0")
    dates.push(`${y}-${m}-${d}`)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  }

  return dates
}

export function isMultiDayOperationalRange(
  startDate: string,
  dueDate: string
): boolean {
  return listWorkDatesInRange(startDate, dueDate).length > 1
}

/**
 * Even split with remainder on last days (same as legacy planning fallback).
 */
export function buildAutomaticDailyAllocations(
  startDate: string,
  dueDate: string,
  totalMinutes: number
): TaskDailyAllocationDraft[] {
  const dates = listWorkDatesInRange(startDate, dueDate)
  if (dates.length === 0 || totalMinutes <= 0) {
    return []
  }

  if (dates.length === 1) {
    return [{ workDate: dates[0]!, allocatedMinutes: totalMinutes }]
  }

  const spanDays = dates.length
  const base = Math.floor(totalMinutes / spanDays)
  const remainder = totalMinutes % spanDays

  return dates.map((workDate, index) => {
    const dayIndex = index + 1
    return {
      workDate,
      allocatedMinutes: base + (dayIndex > spanDays - remainder ? 1 : 0),
    }
  })
}

export function sumAllocatedMinutes(
  allocations: readonly TaskDailyAllocationDraft[]
): number {
  return allocations.reduce((sum, row) => sum + row.allocatedMinutes, 0)
}

export function validateManualDailyAllocations(input: {
  startDate: string
  dueDate: string
  totalMinutes: number
  allocations: readonly TaskDailyAllocationDraft[]
}): { ok: true } | { ok: false; message: string } {
  const { startDate, dueDate, totalMinutes, allocations } = input
  const allowedDates = new Set(listWorkDatesInRange(startDate, dueDate))

  if (allowedDates.size === 0) {
    return { ok: false, message: "Indique un rango de fechas válido." }
  }

  if (totalMinutes <= 0) {
    return {
      ok: false,
      message: "Indique una duración total válida antes de distribuir.",
    }
  }

  if (allocations.length !== allowedDates.size) {
    return {
      ok: false,
      message: "La distribución debe cubrir todos los días del rango de la OT.",
    }
  }

  for (const row of allocations) {
    if (!allowedDates.has(row.workDate)) {
      return {
        ok: false,
        message: "No se permiten fechas fuera del rango de la OT.",
      }
    }
    if (!Number.isFinite(row.allocatedMinutes) || row.allocatedMinutes <= 0) {
      return {
        ok: false,
        message: "Cada día debe tener más de 0 minutos asignados.",
      }
    }
  }

  const seen = new Set<string>()
  for (const row of allocations) {
    if (seen.has(row.workDate)) {
      return { ok: false, message: "Hay fechas duplicadas en la distribución." }
    }
    seen.add(row.workDate)
  }

  if (sumAllocatedMinutes(allocations) !== totalMinutes) {
    return { ok: false, message: DAILY_ALLOCATION_SUM_MISMATCH_MESSAGE }
  }

  return { ok: true }
}

export function resolveMinutesForWorkDate(
  allocations: readonly TaskDailyAllocationDraft[] | null | undefined,
  workDate: string
): number | null {
  if (!allocations || allocations.length === 0) {
    return null
  }

  const match = allocations.find((row) => row.workDate === workDate.trim())
  return match ? match.allocatedMinutes : 0
}

export function resolveDailyAllocationMode(
  allocations: readonly TaskDailyAllocationDraft[] | null | undefined
): TaskDailyAllocationMode {
  return allocations && allocations.length > 0 ? "manual" : "automatic"
}

function formatDayLabel(workDate: string): string {
  try {
    return formatDateOnly(workDate)
  } catch {
    return workDate
  }
}

export function formatDailyAllocationHistoryNote(
  before: readonly TaskDailyAllocationDraft[] | null | undefined,
  after: readonly TaskDailyAllocationDraft[] | null | undefined,
  options?: { actor?: string }
): string | null {
  const prev = before ?? []
  const next = after ?? []

  if (prev.length === 0 && next.length === 0) {
    return null
  }

  const actor = options?.actor?.trim()
  const prefix = actor ? `${actor}: ` : ""

  if (prev.length === 0 && next.length > 0) {
    const parts = next.map(
      (row) => `${formatDayLabel(row.workDate)}: ${row.allocatedMinutes} min`
    )
    return `${prefix}Distribución diaria (manual): ${parts.join("; ")}.`
  }

  if (prev.length > 0 && next.length === 0) {
    return `${prefix}Distribución diaria: vuelta a automática.`
  }

  const prevMap = new Map(prev.map((row) => [row.workDate, row.allocatedMinutes]))
  const nextMap = new Map(next.map((row) => [row.workDate, row.allocatedMinutes]))
  const dates = [...new Set([...prevMap.keys(), ...nextMap.keys()])].sort()
  const changes: string[] = []

  for (const date of dates) {
    const from = prevMap.get(date)
    const to = nextMap.get(date)
    if (from === to) continue
    if (from == null) {
      changes.push(`${formatDayLabel(date)}: — → ${to} min`)
    } else if (to == null) {
      changes.push(`${formatDayLabel(date)}: ${from} → —`)
    } else {
      changes.push(`${formatDayLabel(date)}: ${from} → ${to}`)
    }
  }

  if (changes.length === 0) {
    return null
  }

  return `${prefix}Distribución diaria: ${changes.join("; ")}.`
}

export function parseTotalMinutesFromEstimatedDuration(
  estimatedDuration: string
): number {
  return parseEstimatedDurationMinutes(estimatedDuration)
}

/**
 * When range/duration changes in manual mode, rebuild rows for new dates.
 * Preserves minutes for overlapping dates; fills gaps from automatic split.
 */
export function rebaseManualAllocations(input: {
  startDate: string
  dueDate: string
  totalMinutes: number
  previous: readonly TaskDailyAllocationDraft[]
}): TaskDailyAllocationDraft[] {
  const automatic = buildAutomaticDailyAllocations(
    input.startDate,
    input.dueDate,
    input.totalMinutes
  )
  const previousMap = new Map(
    input.previous.map((row) => [row.workDate, row.allocatedMinutes])
  )

  return automatic.map((row) => ({
    workDate: row.workDate,
    allocatedMinutes: previousMap.get(row.workDate) ?? row.allocatedMinutes,
  }))
}
