import type {
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"
import {
  formatDateOnly,
  formatDateOnlyDateTime,
} from "@/lib/dates/date-only"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import {
  buildTaskStatusStyleMap,
} from "@/lib/tasks/status-visual"

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  programada: "Programada",
  asignada: "Asignada",
  vencida: "Vencida",
  "en-curso": "En curso",
  incidencia: "Incidencia",
  "pendiente-cierre": "Pendiente de cierre",
  finalizada: "Finalizada",
  "en-aprobacion": "En Aprobación",
  /** @deprecated Legacy DB value — normalizado a finalizada en runtime. */
  cerrada: "Finalizada",
  cancelada: "Cancelada",
}

export const TASK_EN_CURSO_STYLE = STATUS_TONE_STYLES.orange

export const TASK_STATUS_STYLES: Record<TaskStatus, string> =
  buildTaskStatusStyleMap()

export { getTaskStatusBadgeClass, getTaskStatusSurfaceClass, getTaskRowSurfaceClass } from "@/lib/tasks/status-visual"

export const KANBAN_COLUMNS: TaskStatus[] = [
  "programada",
  "asignada",
  "vencida",
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "finalizada",
  "en-aprobacion",
  "cancelada",
]

export {
  ACTIVE_TASK_STATUSES,
  FINAL_TASK_STATUSES,
  isActiveTaskStatus,
  isFinalTaskStatus,
} from "@/lib/tasks/status-groups"
export {
  isTaskArchivedStatus,
  isTaskArchivedStatus as canArchiveTaskByStatus,
} from "@/lib/tasks/task-archived-status"

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  fiber: "Fibra Óptica",
  camera: "Cámaras",
  wireless: "Wireless",
  pole: "Postación",
  maintenance: "Mantenimiento",
  inspection: "Inspección",
}

export const TASK_TYPE_STYLES: Record<TaskType, string> = {
  fiber: "bg-blue-50 text-blue-700 border-blue-100",
  camera: "bg-violet-50 text-violet-700 border-violet-100",
  wireless: "bg-amber-50 text-amber-700 border-amber-100",
  pole: "bg-stone-100 text-stone-700 border-stone-200",
  maintenance: "bg-teal-50 text-teal-700 border-teal-100",
  inspection: "bg-indigo-50 text-indigo-700 border-indigo-100",
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
}

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  alta: STATUS_TONE_STYLES.red,
  media: STATUS_TONE_STYLES.yellow,
  baja: STATUS_TONE_STYLES.gray,
}

export const TASK_PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_LABELS).map(
  ([value, label]) => ({ value: value as TaskPriority, label })
)

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS)
  .filter(([value]) => value !== "cerrada")
  .map(([value, label]) => ({ value: value as TaskStatus, label }))

export const TASK_TYPE_OPTIONS = Object.entries(TASK_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as TaskType, label })
)

export function formatTaskDate(date: string) {
  return formatDateOnly(date)
}

export function formatTaskDateTime(date: string) {
  return formatDateOnlyDateTime(date)
}

export const TASK_OPERATION_LABELS = {
  obra: "OBRA",
  servicio: "SERVICIO",
} as const

export const TASK_OPERATION_STYLES = {
  obra: "bg-sky-50 text-sky-700 border-sky-100",
  servicio: "bg-orange-50 text-orange-700 border-orange-100",
} as const
