/**
 * OPS 2.4 — presentation-only helpers for planning UI density.
 * No Planning Engine math.
 *
 * UX rule: colors are for actionable states only — never for descriptive
 * travel duration/distance (see OPS 2.4.4).
 */

import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"

/** Formats HH:MM + duration minutes → HH:MM (display only). */
export function formatPlanningEstimatedClockTime(
  startTime: string,
  addMinutes: number
): string {
  const match = startTime.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) {
    return "—"
  }
  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "—"
  }
  const total = ((hours * 60 + minutes + Math.max(0, Math.round(addMinutes))) %
    (24 * 60) +
    24 * 60) %
    (24 * 60)
  const endH = Math.floor(total / 60)
  const endM = total % 60
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`
}

export function formatPlanningTravelDistanceLabel(meters: number): string | null {
  if (!(meters > 0)) {
    return null
  }
  const km = Math.round((meters / 1000) * 10) / 10
  return `${km.toFixed(1).replace(".", ",")} km`
}

/** Occupancy color for crew KPI cards. */
export function resolvePlanningOccupancyToneClass(
  occupancyPercent: number,
  taskCount: number
): string {
  if (taskCount <= 0) {
    return "bg-white/20"
  }
  if (occupancyPercent > 100) {
    return "bg-red-500/90"
  }
  if (occupancyPercent >= 85) {
    return "bg-amber-400/90"
  }
  return "bg-emerald-400/90"
}

/**
 * Capacity margin label from SummaryService fields only.
 * remainingMinutes is already clamped ≥0; excess uses available vs total.
 */
export function resolvePlanningCapacityMargin(input: {
  remainingMinutes: number
  availableMinutes: number
  totalMinutes: number
}): {
  kind: "available" | "excess" | "balanced"
  label: string
  signedValue: string
  toneClass: string
} {
  const remaining = Math.max(0, Math.round(input.remainingMinutes))
  const excess = Math.max(
    0,
    Math.round(input.totalMinutes) - Math.round(input.availableMinutes)
  )

  if (excess > 0) {
    return {
      kind: "excess",
      label: "Exceso",
      signedValue: `-${excess} min`,
      toneClass: "text-red-700",
    }
  }

  if (remaining > 0) {
    return {
      kind: "available",
      label: "Disponible",
      signedValue: `+${remaining} min`,
      toneClass: "text-emerald-700",
    }
  }

  return {
    kind: "balanced",
    label: "Disponible",
    signedValue: "0 min",
    toneClass: "text-slate-600",
  }
}

/**
 * Compact duration for planning table cells (display only).
 * "60 min" → "60m", "90 min" → "1h 30m"
 */
export function formatPlanningDurationCompact(
  value: string | null | undefined
): string {
  if (!value?.trim()) {
    return "—"
  }

  const minutes = parseEstimatedDurationMinutes(value)
  if (minutes <= 0) {
    return value.trim()
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) {
    return `${rest}m`
  }
  if (rest === 0) {
    return `${hours}h`
  }
  return `${hours}h ${rest}m`
}
