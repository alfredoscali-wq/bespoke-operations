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

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  "en-curso": "En Curso",
  finalizada: "Finalizada",
  "en-aprobacion": "En Aprobación",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
}

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  pendiente: STATUS_TONE_STYLES.gray,
  asignada: STATUS_TONE_STYLES.blue,
  "en-curso": STATUS_TONE_STYLES.yellow,
  finalizada: STATUS_TONE_STYLES.violet,
  "en-aprobacion": STATUS_TONE_STYLES.yellow,
  cerrada: STATUS_TONE_STYLES.green,
  cancelada: STATUS_TONE_STYLES.red,
}

export const KANBAN_COLUMNS: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "finalizada",
  "en-aprobacion",
  "cerrada",
  "cancelada",
]

export {
  ACTIVE_TASK_STATUSES,
  FINAL_TASK_STATUSES,
  canArchiveTaskByStatus,
  isActiveTaskStatus,
  isFinalTaskStatus,
} from "@/lib/tasks/status-groups"

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

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as TaskStatus, label })
)

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
