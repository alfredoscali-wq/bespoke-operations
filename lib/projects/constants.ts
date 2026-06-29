import { formatDateOnly } from "@/lib/dates/date-only"
import type {
  ProjectPauseReason,
  ProjectStatus,
  ProjectType,
} from "@/lib/types/projects"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planificada",
  active: "Activa",
  paused: "Pausada",
  "pending-closure": "Pendiente de cierre",
  closed: "Finalizada",
  cancelled: "Cancelada",
}

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planned: STATUS_TONE_STYLES.gray,
  active: STATUS_TONE_STYLES.green,
  paused: STATUS_TONE_STYLES.yellow,
  "pending-closure": STATUS_TONE_STYLES.violet,
  closed: STATUS_TONE_STYLES.neutral,
  cancelled: STATUS_TONE_STYLES.red,
}

export const PROJECT_PAUSE_REASON_LABELS: Record<ProjectPauseReason, string> = {
  climatic: "Climático",
  materials: "Falta de materiales",
  client: "Cliente",
  permits: "Permisos",
  resources: "Recursos",
  safety: "Seguridad",
  other: "Otro",
}

export const PROJECT_PAUSE_REASON_OPTIONS = Object.entries(
  PROJECT_PAUSE_REASON_LABELS
).map(([value, label]) => ({
  value: value as ProjectPauseReason,
  label,
}))

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

export const PROJECT_TYPE_OPTIONS = Object.entries(PROJECT_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as ProjectType, label })
)

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as ProjectStatus, label })
)

/** Explicación operativa de cada KPI en el detalle de obra. */
export const PROJECT_OPERATIONAL_KPI_HINTS = {
  assignedCrews:
    "Cuadrillas activas con al menos una orden de trabajo activa asignada en esta obra.",
  assignedPersonnel:
    "Integrantes activos en esas cuadrillas. Incluye registros legacy sin vínculo RRHH; deduplica por empleado cuando aplica.",
  activeTasks: "Órdenes de trabajo en curso operativo (programada, asignada, en curso o en aprobación).",
  completedTasks: "Órdenes de trabajo finalizadas, cerradas o canceladas vinculadas a la obra.",
  evidenceFiles: "Evidencias activas registradas para la obra.",
  progress: "Avance acumulado reportado en la ficha de la obra.",
} as const

export function formatDate(date?: string | null) {
  return formatDateOnly(date, { emptyLabel: "Sin definir" })
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}
