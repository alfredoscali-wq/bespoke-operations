/**
 * Isolated workforce activity-status classifier.
 * Based only on event count for now — replace thresholds later without UI changes.
 */
export type WorkforceActivityStatus =
  | "sin_actividad"
  | "baja_actividad"
  | "actividad_normal"
  | "alta_actividad"

export const WORKFORCE_ACTIVITY_STATUS_LABELS: Record<
  WorkforceActivityStatus,
  string
> = {
  sin_actividad: "Sin actividad",
  baja_actividad: "Baja actividad",
  actividad_normal: "Actividad normal",
  alta_actividad: "Alta actividad",
}

/** Temporary thresholds by event count. Not a productivity judgment. */
const WORKFORCE_ACTIVITY_STATUS_THRESHOLDS = {
  bajaMax: 5,
  normalMax: 20,
} as const

export function classifyWorkforceActivityStatus(
  eventCount: number
): WorkforceActivityStatus {
  const count = Number.isFinite(eventCount) ? Math.max(0, Math.floor(eventCount)) : 0

  if (count <= 0) return "sin_actividad"
  if (count <= WORKFORCE_ACTIVITY_STATUS_THRESHOLDS.bajaMax) {
    return "baja_actividad"
  }
  if (count <= WORKFORCE_ACTIVITY_STATUS_THRESHOLDS.normalMax) {
    return "actividad_normal"
  }
  return "alta_actividad"
}
