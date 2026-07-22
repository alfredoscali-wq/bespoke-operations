import type { Task } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import {
  getTaskStatusBadgeClass,
} from "@/lib/tasks/status-visual"
import { isTaskArchivedStatus } from "@/lib/tasks/task-archived-status"
import {
  hasActivePlanningReturn,
  PLANNING_RETURNED_DISPLAY_LABEL,
} from "@/lib/tasks/planning-return"

import { taskHasAssignedCrew } from "@/lib/tasks/vencida-status"

export type OperationalTaskCategory =
  | "programadas"
  | "asignadas"
  | "en-curso"
  | "pendientes-cierre"
  | "finalizadas"
  | "canceladas"

export const OPERATIONAL_CATEGORY_KPI_LABELS: Record<
  OperationalTaskCategory,
  string
> = {
  programadas: "Programadas",
  asignadas: "Asignadas",
  "en-curso": "En curso",
  "pendientes-cierre": "Pendientes de cierre",
  finalizadas: "Archivo OT",
  canceladas: "Canceladas",
}

export const OPERATIONAL_CATEGORY_BADGE_LABELS: Record<
  OperationalTaskCategory,
  string
> = {
  programadas: "Programada",
  asignadas: "Asignada",
  "en-curso": "En curso",
  "pendientes-cierre": "Pendiente de cierre",
  finalizadas: "Archivo OT",
  canceladas: "Cancelada",
}

export const OPERATIONAL_CATEGORY_ORDER: OperationalTaskCategory[] = [
  "programadas",
  "asignadas",
  "en-curso",
  "pendientes-cierre",
  "finalizadas",
  "canceladas",
]

export const OPERATIONAL_CATEGORY_KPI_TONE: Record<
  OperationalTaskCategory,
  VisualTone
> = {
  programadas: "blue",
  asignadas: "yellow",
  "en-curso": "orange",
  "pendientes-cierre": "violet",
  finalizadas: "green",
  canceladas: "red",
}

export const OPERATIONAL_CATEGORY_KPI_CARD_CLASS: Partial<
  Record<OperationalTaskCategory, string>
> = {}

export const OPERATIONAL_CATEGORY_BADGE_STYLES: Record<
  OperationalTaskCategory,
  string
> = {
  programadas: getTaskStatusBadgeClass("programada"),
  asignadas: getTaskStatusBadgeClass("asignada"),
  "en-curso": getTaskStatusBadgeClass("en-curso"),
  "pendientes-cierre": getTaskStatusBadgeClass("pendiente-cierre"),
  finalizadas: getTaskStatusBadgeClass("finalizada"),
  canceladas: getTaskStatusBadgeClass("cancelada"),
}

export function resolveOperationalExecutionBadge(task: Task): {
  label: string
  className: string
} {
  if (hasActivePlanningReturn(task)) {
    return {
      label: PLANNING_RETURNED_DISPLAY_LABEL,
      className: getTaskStatusBadgeClass("vencida"),
    }
  }

  if (task.status === "vencida") {
    return {
      label: "Vencida",
      className: getTaskStatusBadgeClass("vencida"),
    }
  }

  if (task.status === "incidencia") {
    return {
      label: "Incidencia",
      className: getTaskStatusBadgeClass("incidencia"),
    }
  }

  if (task.status === "programada") {
    return {
      label: "Programada",
      className: getTaskStatusBadgeClass("programada"),
    }
  }

  if (task.status === "asignada") {
    return {
      label: "Asignada",
      className: getTaskStatusBadgeClass("asignada"),
    }
  }

  if (task.status === "en-curso") {
    return {
      label: "En curso",
      className: getTaskStatusBadgeClass("en-curso"),
    }
  }

  if (task.status === "pendiente-cierre" || task.status === "en-aprobacion") {
    return {
      label: "Pendiente de cierre",
      className: getTaskStatusBadgeClass("pendiente-cierre"),
    }
  }

  if (isTaskArchivedStatus(task.status)) {
    return {
      label: "Finalizada",
      className: getTaskStatusBadgeClass("finalizada"),
    }
  }

  if (task.status === "cancelada") {
    return {
      label: "Cancelada",
      className: getTaskStatusBadgeClass("cancelada"),
    }
  }

  const category = resolveOperationalCategory(task)

  return {
    label: OPERATIONAL_CATEGORY_BADGE_LABELS[category],
    className: OPERATIONAL_CATEGORY_BADGE_STYLES[category],
  }
}

export function resolveOperationalCategory(
  task: Task
): OperationalTaskCategory {
  if (task.status === "cancelada") {
    return "canceladas"
  }

  if (isTaskArchivedStatus(task.status)) {
    return "finalizadas"
  }

  if (task.status === "pendiente-cierre" || task.status === "en-aprobacion") {
    return "pendientes-cierre"
  }

  if (task.status === "en-curso" || task.status === "incidencia") {
    return "en-curso"
  }

  if (task.status === "asignada") {
    return "asignadas"
  }

  if (task.status === "vencida") {
    return taskHasAssignedCrew(task) ? "asignadas" : "programadas"
  }

  if (task.status === "programada") {
    return "programadas"
  }

  return "programadas"
}

export function filterTasksByOperationalCategory(
  tasks: Task[],
  category: OperationalTaskCategory
): Task[] {
  return tasks.filter(
    (task) => resolveOperationalCategory(task) === category
  )
}

export function countTasksByOperationalCategory(
  tasks: Task[]
): Record<OperationalTaskCategory, number> {
  const counts: Record<OperationalTaskCategory, number> = {
    programadas: 0,
    asignadas: 0,
    "en-curso": 0,
    "pendientes-cierre": 0,
    finalizadas: 0,
    canceladas: 0,
  }

  for (const task of tasks) {
    const category = resolveOperationalCategory(task)
    counts[category] += 1
  }

  return counts
}

export function formatTaskOperationalCode(code: string): string {
  return code.startsWith("#") ? code : `#${code}`
}

export function resolveTaskClientLabel(task: Task): string {
  return (
    task.customerName?.trim() ||
    task.customerCompany?.trim() ||
    task.projectName?.trim() ||
    "—"
  )
}

export function resolveTaskAddressLabel(task: Task): string {
  const address = task.serviceAddress?.trim()
  const locality = task.locality?.trim()

  if (address && locality) {
    return `${address} - ${locality}`
  }

  return address || locality || task.projectName?.trim() || "—"
}

export function resolveTaskCrewOperationalLabel(
  crewName: string | null | undefined
): string {
  return crewName?.trim() || "Sin cuadrilla"
}
