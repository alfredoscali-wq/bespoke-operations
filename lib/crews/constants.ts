import type { CrewActivityType, CrewStatus, MemberStatus } from "@/lib/types/crews"

export const CREW_NAMES = [
  "Cuadrilla Norte",
  "Cuadrilla Alpha",
  "Cuadrilla Bravo",
  "Cuadrilla Charlie",
  "Cuadrilla Postación",
  "Cuadrilla Wireless",
  "Cuadrilla Foxtrot",
] as const

export type CrewName = (typeof CREW_NAMES)[number]

export const CREW_NAME_TO_ID: Record<CrewName, string> = {
  "Cuadrilla Norte": "crew-norte",
  "Cuadrilla Alpha": "crew-alpha",
  "Cuadrilla Bravo": "crew-bravo",
  "Cuadrilla Charlie": "crew-charlie",
  "Cuadrilla Postación": "crew-delta",
  "Cuadrilla Wireless": "crew-echo",
  "Cuadrilla Foxtrot": "crew-foxtrot",
}

export function getCrewIdByName(name: string): string | undefined {
  return CREW_NAME_TO_ID[name as CrewName]
}

export const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  disponible: "Disponible",
  "en-campo": "En Campo",
  "fuera-de-servicio": "Fuera de Servicio",
}

export const CREW_STATUS_STYLES: Record<CrewStatus, string> = {
  disponible: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "en-campo": "bg-blue-50 text-blue-700 border-blue-100",
  "fuera-de-servicio": "bg-slate-100 text-slate-600 border-slate-200",
}

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  disponible: "Disponible",
  "en-campo": "En Campo",
  "fuera-de-servicio": "Fuera de Servicio",
}

export const MEMBER_STATUS_STYLES: Record<MemberStatus, string> = {
  disponible: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "en-campo": "bg-blue-50 text-blue-700 border-blue-100",
  "fuera-de-servicio": "bg-red-50 text-red-700 border-red-100",
}

export const CREW_ACTIVITY_LABELS: Record<CrewActivityType, string> = {
  "task-assigned": "Tarea asignada",
  "work-started": "Trabajo iniciado",
  "evidence-uploaded": "Evidencia cargada",
  "task-completed": "Tarea completada",
  "project-completed": "Proyecto completado",
}

export const CREW_STATUS_OPTIONS = Object.entries(CREW_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as CrewStatus,
    label,
  })
)

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
