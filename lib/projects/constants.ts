import type { ProjectStatus, ProjectType } from "@/lib/types/projects"

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planificada",
  active: "Activa",
  paused: "Pausada",
  "pending-closure": "Pendiente de Cierre",
  closed: "Cerrada",
}

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  paused: "bg-amber-50 text-amber-700 border-amber-100",
  "pending-closure": "bg-violet-50 text-violet-700 border-violet-100",
  closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  fiber: "Fibra Óptica",
  camera: "Cámaras",
  wireless: "Wireless",
  pole: "Postes",
  maintenance: "Mantenimiento",
}

export const PROJECT_TYPE_STYLES: Record<ProjectType, string> = {
  fiber: "bg-blue-50 text-blue-700 border-blue-100",
  camera: "bg-violet-50 text-violet-700 border-violet-100",
  wireless: "bg-amber-50 text-amber-700 border-amber-100",
  pole: "bg-stone-100 text-stone-700 border-stone-200",
  maintenance: "bg-teal-50 text-teal-700 border-teal-100",
}

export const SUPERVISORS = [
  "Ing. Roberto Méndez",
  "Ing. Ana Torres",
  "Ing. Carlos Ruiz",
  "Ing. Patricia Vega",
] as const

export const PROJECT_TYPE_OPTIONS = Object.entries(PROJECT_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as ProjectType, label })
)

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as ProjectStatus, label })
)

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}
