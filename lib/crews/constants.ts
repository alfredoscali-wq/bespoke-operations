import type { CrewActivityType, CrewStatus } from "@/lib/types/crews"
import { formatDateOnly, formatDateOnlyDateTime } from "@/lib/dates/date-only"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

export const CREW_ACTIVITY_LABELS: Record<CrewActivityType, string> = {
  "task-assigned": "Tarea asignada",
  "work-started": "Trabajo iniciado",
  "evidence-uploaded": "Evidencia cargada",
  "task-completed": "Tarea completada",
  "project-completed": "Proyecto completado",
}

export const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  activa: "Activa",
  inactiva: "Inactiva",
  "en-campo": "En Campo",
}

export const CREW_STATUS_STYLES: Record<CrewStatus, string> = {
  activa: STATUS_TONE_STYLES.green,
  inactiva: STATUS_TONE_STYLES.gray,
  "en-campo": STATUS_TONE_STYLES.blue,
}

export const MEMBER_ACTIVE_LABEL = "Activo"
export const MEMBER_INACTIVE_LABEL = "Inactivo"

export const MEMBER_ACTIVE_STYLES = STATUS_TONE_STYLES.green
export const MEMBER_INACTIVE_STYLES = STATUS_TONE_STYLES.gray

export const CREW_AVAILABILITY_STATUS_LABELS = {
  OPERATIONAL: "Operativa",
  REDUCED_CAPACITY: "Capacidad reducida",
  NOT_OPERATIONAL: "No operativa",
} as const

export const CREW_AVAILABILITY_STATUS_STYLES = {
  OPERATIONAL: STATUS_TONE_STYLES.green,
  REDUCED_CAPACITY: STATUS_TONE_STYLES.yellow,
  NOT_OPERATIONAL: STATUS_TONE_STYLES.red,
} as const

export const CREW_STATUS_OPTIONS = Object.entries(CREW_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as CrewStatus,
    label,
  })
)

/** @deprecated Use getSupervisorEmployees from lib/employees/utils */
export const CREW_SUPERVISOR_OPTIONS: readonly string[] = []

/** @deprecated Use crew names from CrewsProvider instead */
export const CREW_NAMES: readonly string[] = []

export function formatCrewDate(date: string) {
  return formatDateOnly(date)
}

export function formatCrewDateTime(date: string) {
  return formatDateOnlyDateTime(date)
}
