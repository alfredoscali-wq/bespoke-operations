import type { Task } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

export type OperationalTaskCategory =
  | "sin-cuadrilla"
  | "programadas"
  | "suspendidas"
  | "completadas"
  | "canceladas"

const ACTIVE_INTERNAL_STATUSES = new Set<Task["status"]>([
  "asignada",
  "en-curso",
  "en-aprobacion",
])

export const OPERATIONAL_CATEGORY_KPI_LABELS: Record<
  OperationalTaskCategory,
  string
> = {
  "sin-cuadrilla": "🔵 Sin cuadrilla",
  programadas: "🟢 Programadas",
  suspendidas: "🟡 Suspendidas",
  completadas: "🟠 Completadas",
  canceladas: "🔴 Canceladas",
}

export const OPERATIONAL_CATEGORY_BADGE_LABELS: Record<
  OperationalTaskCategory,
  string
> = {
  "sin-cuadrilla": "🔵 Sin cuadrilla",
  programadas: "🟢 Programada",
  suspendidas: "🟡 Suspendida",
  completadas: "🟠 Completada",
  canceladas: "🔴 Cancelada",
}

/** @deprecated Use OPERATIONAL_CATEGORY_BADGE_LABELS for card badges. */
export const OPERATIONAL_CATEGORY_LABELS = OPERATIONAL_CATEGORY_BADGE_LABELS

export const OPERATIONAL_CATEGORY_ORDER: OperationalTaskCategory[] = [
  "sin-cuadrilla",
  "programadas",
  "suspendidas",
  "completadas",
  "canceladas",
]

export const OPERATIONAL_CATEGORY_KPI_TONE: Record<
  OperationalTaskCategory,
  VisualTone
> = {
  "sin-cuadrilla": "blue",
  programadas: "green",
  suspendidas: "yellow",
  completadas: "yellow",
  canceladas: "red",
}

export const OPERATIONAL_CATEGORY_KPI_CARD_CLASS: Partial<
  Record<OperationalTaskCategory, string>
> = {
  completadas: "border-orange-100/80 bg-orange-500/[0.04]",
}

export const OPERATIONAL_CATEGORY_BADGE_STYLES: Record<
  OperationalTaskCategory,
  string
> = {
  "sin-cuadrilla": STATUS_TONE_STYLES.blue,
  programadas: STATUS_TONE_STYLES.green,
  suspendidas: STATUS_TONE_STYLES.yellow,
  completadas: "border-orange-200/80 bg-orange-50 text-orange-800",
  canceladas: STATUS_TONE_STYLES.red,
}

function isPendingAssignment(task: Task): boolean {
  return task.status === "pendiente" || !task.crewId
}

export function resolveOperationalCategory(
  task: Task
): OperationalTaskCategory {
  if (task.status === "cancelada") {
    return "canceladas"
  }

  if (task.status === "finalizada" || task.status === "cerrada") {
    return "completadas"
  }

  if (isPendingAssignment(task)) {
    return "sin-cuadrilla"
  }

  if (ACTIVE_INTERNAL_STATUSES.has(task.status)) {
    return "programadas"
  }

  return "sin-cuadrilla"
}

export function filterTasksByOperationalCategory(
  tasks: Task[],
  category: OperationalTaskCategory
): Task[] {
  if (category === "suspendidas") {
    return []
  }

  return tasks.filter(
    (task) => resolveOperationalCategory(task) === category
  )
}

export function countTasksByOperationalCategory(
  tasks: Task[]
): Record<OperationalTaskCategory, number> {
  const counts: Record<OperationalTaskCategory, number> = {
    "sin-cuadrilla": 0,
    programadas: 0,
    suspendidas: 0,
    completadas: 0,
    canceladas: 0,
  }

  for (const task of tasks) {
    const category = resolveOperationalCategory(task)
    counts[category] += 1
  }

  counts.suspendidas = 0

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
