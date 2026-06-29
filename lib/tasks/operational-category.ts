import type { Task } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { TASK_EN_CURSO_STYLE } from "@/lib/tasks/constants"
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
  finalizadas: "Finalizadas",
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
  finalizadas: "Finalizada",
  canceladas: "Cancelada",
}

/** @deprecated Use OPERATIONAL_CATEGORY_BADGE_LABELS for card badges. */
export const OPERATIONAL_CATEGORY_LABELS = OPERATIONAL_CATEGORY_BADGE_LABELS

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
  asignadas: "blue",
  "en-curso": "yellow",
  "pendientes-cierre": "yellow",
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
  programadas: STATUS_TONE_STYLES.blue,
  asignadas: STATUS_TONE_STYLES.blue,
  "en-curso": TASK_EN_CURSO_STYLE,
  "pendientes-cierre": STATUS_TONE_STYLES.yellow,
  finalizadas: STATUS_TONE_STYLES.green,
  canceladas: STATUS_TONE_STYLES.red,
}

export function resolveOperationalExecutionBadge(task: Task): {
  label: string
  className: string
} {
  if (task.status === "vencida") {
    return {
      label: "🔴 Vencida",
      className: STATUS_TONE_STYLES.red,
    }
  }

  if (task.status === "incidencia") {
    return {
      label: "🔴 Incidencia",
      className: STATUS_TONE_STYLES.red,
    }
  }

  if (task.status === "programada") {
    return {
      label: "Programada",
      className: STATUS_TONE_STYLES.blue,
    }
  }

  if (task.status === "asignada") {
    return {
      label: "Asignada",
      className: STATUS_TONE_STYLES.blue,
    }
  }

  if (task.status === "en-curso") {
    return {
      label: "En curso",
      className: TASK_EN_CURSO_STYLE,
    }
  }

  if (task.status === "pendiente-cierre" || task.status === "en-aprobacion") {
    return {
      label: "Pendiente de cierre",
      className: STATUS_TONE_STYLES.yellow,
    }
  }

  if (task.status === "finalizada" || task.status === "cerrada") {
    return {
      label: "Finalizada",
      className: STATUS_TONE_STYLES.green,
    }
  }

  if (task.status === "cancelada") {
    return {
      label: "Cancelada",
      className: STATUS_TONE_STYLES.red,
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

  if (task.status === "finalizada" || task.status === "cerrada") {
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
