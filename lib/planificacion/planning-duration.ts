/**
 * Shared duration parsing/formatting for planning load calculations.
 */

/** Default jornada laboral when a crew has no habitual duration configured. */
export const PLANNING_DEFAULT_AVAILABLE_MINUTES = 8 * 60

export function parseEstimatedDurationMinutes(value: string): number {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return 0
  }

  const minutesMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*min/)
  if (minutesMatch) {
    return Math.round(Number.parseFloat(minutesMatch[1].replace(",", ".")))
  }

  const hoursMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*h(?:ora|oras)?/)
  if (hoursMatch) {
    return Math.round(Number.parseFloat(hoursMatch[1].replace(",", ".")) * 60)
  }

  const daysMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*d(?:ia|ías|ias)?/)
  if (daysMatch) {
    return Math.round(Number.parseFloat(daysMatch[1].replace(",", ".")) * 8 * 60)
  }

  const numeric = Number.parseInt(trimmed, 10)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

export function formatPlanningEstimatedHours(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return "0 h"
  }

  const hours = totalMinutes / 60
  if (hours < 10) {
    return `${hours.toFixed(1).replace(".", ",")} h`
  }

  return `${Math.round(hours)} h`
}

export function formatPlanningEstimatedDurationDetailed(
  totalMinutes: number
): string {
  if (totalMinutes <= 0) {
    return "0 min"
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${minutes} min`
}
