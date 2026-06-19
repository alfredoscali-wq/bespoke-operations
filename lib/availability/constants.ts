import { formatDateOnly } from "@/lib/dates/date-only"
import type { AvailabilityType } from "@/lib/types/availability"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

export const AVAILABILITY_TYPE_LABELS: Record<AvailabilityType, string> = {
  AVAILABLE: "Disponible",
  VACATION: "Vacaciones",
  SICK_LEAVE: "Licencia médica",
  TRAINING: "Capacitación",
  LICENSE: "Licencia",
  OTHER: "Otro",
}

export const AVAILABILITY_TYPE_STYLES: Record<AvailabilityType, string> = {
  AVAILABLE: STATUS_TONE_STYLES.green,
  VACATION: STATUS_TONE_STYLES.red,
  SICK_LEAVE: STATUS_TONE_STYLES.yellow,
  TRAINING: STATUS_TONE_STYLES.yellow,
  LICENSE: STATUS_TONE_STYLES.blue,
  OTHER: STATUS_TONE_STYLES.gray,
}

/** Labels for operational views (crews, calendar) with status indicators. */
export const OPERATIONAL_AVAILABILITY_LABELS: Record<AvailabilityType, string> =
  {
    AVAILABLE: "🟢 Disponible",
    VACATION: "🔴 Vacaciones",
    SICK_LEAVE: "🟠 Licencia médica",
    TRAINING: "🟡 Capacitación",
    LICENSE: "🔵 Licencia",
    OTHER: "⚫ No disponible",
  }

export const AVAILABILITY_TYPE_OPTIONS: {
  value: AvailabilityType
  label: string
}[] = (
  Object.entries(AVAILABILITY_TYPE_LABELS) as [AvailabilityType, string][]
).map(([value, label]) => ({ value, label }))

export const AVAILABILITY_PERIOD_STATUS_LABELS = {
  active: "Activo",
  scheduled: "Programado",
  finished: "Finalizado",
} as const

export const AVAILABILITY_PERIOD_STATUS_STYLES = {
  active: STATUS_TONE_STYLES.green,
  scheduled: STATUS_TONE_STYLES.blue,
  finished: STATUS_TONE_STYLES.gray,
} as const

export function formatAvailabilityDate(value: string): string {
  return formatDateOnly(value, { locale: "es-AR" })
}

export function formatAvailabilityDateRange(
  startDate: string,
  endDate: string
): string {
  return `${formatAvailabilityDate(startDate)} - ${formatAvailabilityDate(endDate)}`
}
