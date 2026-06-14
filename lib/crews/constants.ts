import type { CrewActivityType, CrewStatus } from "@/lib/types/crews"
import { SUPERVISORS } from "@/lib/projects/constants"

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
  activa: "bg-emerald-50 text-emerald-700 border-emerald-100",
  inactiva: "bg-slate-100 text-slate-600 border-slate-200",
  "en-campo": "bg-blue-50 text-blue-700 border-blue-100",
}

export const MEMBER_ACTIVE_LABEL = "Activo"
export const MEMBER_INACTIVE_LABEL = "Inactivo"

export const MEMBER_ACTIVE_STYLES =
  "bg-emerald-50 text-emerald-700 border-emerald-100"
export const MEMBER_INACTIVE_STYLES =
  "bg-slate-100 text-slate-600 border-slate-200"

export const CREW_STATUS_OPTIONS = Object.entries(CREW_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as CrewStatus,
    label,
  })
)

export const CREW_SUPERVISOR_OPTIONS = SUPERVISORS

/** @deprecated Use crew names from CrewsProvider instead */
export const CREW_NAMES: readonly string[] = []

export function formatCrewDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function formatCrewDateTime(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
