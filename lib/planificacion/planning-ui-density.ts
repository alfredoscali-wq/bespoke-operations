/**
 * OPS 2.4 — presentation-only helpers for planning UI density.
 * No Planning Engine math.
 */

import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"

/** Exception-only travel attention (UI). Short trips stay neutral. */
export type PlanningTravelAttention = "none" | "warning" | "critical"

const TRAVEL_WARN_MINUTES = 45
const TRAVEL_WARN_METERS = 50_000
const TRAVEL_CRITICAL_MINUTES = 60
const TRAVEL_CRITICAL_METERS = 80_000

export function resolvePlanningTravelAttention(input: {
  minutes: number
  distanceMeters?: number
}): PlanningTravelAttention {
  const minutes = Math.max(0, input.minutes)
  const meters = Math.max(0, input.distanceMeters ?? 0)

  if (minutes > TRAVEL_CRITICAL_MINUTES || meters > TRAVEL_CRITICAL_METERS) {
    return "critical"
  }
  if (minutes > TRAVEL_WARN_MINUTES || meters > TRAVEL_WARN_METERS) {
    return "warning"
  }
  return "none"
}

export function resolvePlanningTravelAttentionToneClass(
  attention: PlanningTravelAttention
): string {
  switch (attention) {
    case "critical":
      return "text-red-700"
    case "warning":
      return "text-orange-700"
    default:
      return "text-slate-600"
  }
}

export function resolvePlanningTravelAttentionShellClass(
  attention: PlanningTravelAttention
): string {
  switch (attention) {
    case "critical":
      return "border border-red-200/70 bg-red-50/50"
    case "warning":
      return "border border-orange-200/70 bg-orange-50/40"
    default:
      return "border border-transparent bg-transparent"
  }
}

export function resolvePlanningTravelAttentionLabel(
  attention: PlanningTravelAttention
): string | null {
  switch (attention) {
    case "critical":
      return "🔴 Crítico"
    case "warning":
      return "🟠 Advertencia"
    default:
      return null
  }
}

/** @deprecated Prefer resolvePlanningTravelAttention — kept for residual callers. */
export function resolvePlanningTravelToneClass(minutes: number): string {
  return resolvePlanningTravelAttentionToneClass(
    resolvePlanningTravelAttention({ minutes })
  )
}

/** @deprecated Prefer resolvePlanningTravelAttentionShellClass. */
export function resolvePlanningTravelToneBgClass(minutes: number): string {
  return resolvePlanningTravelAttentionShellClass(
    resolvePlanningTravelAttention({ minutes })
  )
}

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
