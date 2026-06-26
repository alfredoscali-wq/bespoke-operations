import { formatDateOnly } from "@/lib/dates/date-only"
import { getProjectCrews } from "@/lib/projects/utils"
import { getTasksForProject } from "@/lib/tasks/utils"
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks/status-groups"
import type { Crew } from "@/lib/types/crews"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

export type OperationalProjectCategory =
  | "sin-iniciar"
  | "en-ejecucion"
  | "detenida"
  | "finalizada"
  | "cancelada"

export const OPERATIONAL_PROJECT_CATEGORY_KPI_LABELS: Record<
  OperationalProjectCategory,
  string
> = {
  "sin-iniciar": "Sin iniciar",
  "en-ejecucion": "En ejecución",
  detenida: "Detenidas",
  finalizada: "Finalizadas",
  cancelada: "Canceladas",
}

export const OPERATIONAL_PROJECT_CATEGORY_BADGE_LABELS: Record<
  OperationalProjectCategory,
  string
> = {
  "sin-iniciar": "Sin iniciar",
  "en-ejecucion": "En ejecución",
  detenida: "Detenida",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
}

export const OPERATIONAL_PROJECT_CATEGORY_ORDER: OperationalProjectCategory[] =
  ["sin-iniciar", "en-ejecucion", "detenida", "finalizada", "cancelada"]

export const OPERATIONAL_PROJECT_CATEGORY_KPI_TONE: Record<
  OperationalProjectCategory,
  VisualTone
> = {
  "sin-iniciar": "blue",
  "en-ejecucion": "green",
  detenida: "yellow",
  finalizada: "green",
  cancelada: "red",
}

export const OPERATIONAL_PROJECT_CATEGORY_KPI_CARD_CLASS: Partial<
  Record<OperationalProjectCategory, string>
> = {}

export const OPERATIONAL_PROJECT_CATEGORY_BADGE_STYLES: Record<
  OperationalProjectCategory,
  string
> = {
  "sin-iniciar": STATUS_TONE_STYLES.blue,
  "en-ejecucion": STATUS_TONE_STYLES.green,
  detenida: STATUS_TONE_STYLES.yellow,
  finalizada: STATUS_TONE_STYLES.green,
  cancelada: STATUS_TONE_STYLES.red,
}

function getProjectTasks(project: Project, tasks: Task[]): Task[] {
  return getTasksForProject(project, tasks)
}

export function projectHasActiveTasks(project: Project, tasks: Task[]): boolean {
  return getProjectTasks(project, tasks).some((task) =>
    ACTIVE_TASK_STATUSES.includes(task.status)
  )
}

export function resolveOperationalProjectCategory(
  project: Project,
  tasks: Task[] = []
): OperationalProjectCategory {
  if (project.status === "cancelled") {
    return "cancelada"
  }

  if (project.status === "closed") {
    return "finalizada"
  }

  if (projectHasActiveTasks(project, tasks)) {
    return "en-ejecucion"
  }

  return "sin-iniciar"
}

export function filterProjectsByOperationalCategory(
  projects: Project[],
  category: OperationalProjectCategory,
  tasks: Task[] = []
): Project[] {
  if (category === "detenida") {
    return []
  }

  return projects.filter(
    (project) =>
      resolveOperationalProjectCategory(project, tasks) === category
  )
}

export function countProjectsByOperationalCategory(
  projects: Project[],
  tasks: Task[] = []
): Record<OperationalProjectCategory, number> {
  const counts: Record<OperationalProjectCategory, number> = {
    "sin-iniciar": 0,
    "en-ejecucion": 0,
    detenida: 0,
    finalizada: 0,
    cancelada: 0,
  }

  for (const project of projects) {
    const category = resolveOperationalProjectCategory(project, tasks)
    counts[category] += 1
  }

  counts.detenida = 0

  return counts
}

export function formatProjectOperationalCode(code: string): string {
  return code.startsWith("#") ? code : `#${code}`
}

export function resolveProjectLocationLabel(project: Project): string {
  return project.location?.trim() || "—"
}

export function resolveProjectTargetDateLabel(project: Project): string {
  return formatDateOnly(project.endDate, { emptyLabel: "Sin fecha objetivo" })
}

export function resolveProjectPrimaryCrewLabel(
  project: Project,
  tasks: Task[],
  crews: Crew[] = []
): string {
  const projectCrews = getProjectCrews(project, tasks, crews)

  if (projectCrews.length === 0) {
    return "Sin cuadrilla asignada"
  }

  return [...projectCrews].sort((left, right) =>
    left.name.localeCompare(right.name, "es")
  )[0].name
}
