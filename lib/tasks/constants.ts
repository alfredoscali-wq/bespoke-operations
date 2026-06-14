import type {
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  "en-curso": "En Curso",
  finalizada: "Finalizada",
  "en-aprobacion": "En Aprobación",
  cerrada: "Cerrada",
}

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  pendiente: "bg-slate-100 text-slate-700 border-slate-200",
  asignada: "bg-blue-50 text-blue-700 border-blue-100",
  "en-curso": "bg-amber-50 text-amber-700 border-amber-100",
  finalizada: "bg-violet-50 text-violet-700 border-violet-100",
  "en-aprobacion": "bg-orange-50 text-orange-700 border-orange-100",
  cerrada: "bg-emerald-50 text-emerald-700 border-emerald-100",
}

export const KANBAN_COLUMNS: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "finalizada",
  "en-aprobacion",
  "cerrada",
]

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
  alta: "bg-red-50 text-red-700 border-red-100",
  media: "bg-amber-50 text-amber-700 border-amber-100",
  baja: "bg-slate-100 text-slate-600 border-slate-200",
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
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function formatTaskDateTime(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
