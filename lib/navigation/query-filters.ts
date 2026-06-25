import type { ProjectStatus } from "@/lib/types/projects"
import type { TaskStatus } from "@/lib/types/tasks"

const PROJECT_STATUS_VALUES: ProjectStatus[] = [
  "planned",
  "active",
  "paused",
  "pending-closure",
  "closed",
  "cancelled",
]

const TASK_STATUS_VALUES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
  "finalizada",
  "cerrada",
  "cancelada",
]

export function parseProjectStatusQuery(
  value: string | null
): ProjectStatus | "all" {
  if (!value) return "all"
  return PROJECT_STATUS_VALUES.includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : "all"
}

export function parseTaskStatusQuery(value: string | null): TaskStatus | "all" {
  if (!value) return "all"
  return TASK_STATUS_VALUES.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : "all"
}
