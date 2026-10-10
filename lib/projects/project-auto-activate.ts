import type { Project, ProjectStatus } from "@/lib/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import { toLocalDateOnly } from "@/lib/dates/date-only"

export function shouldAutoActivateProjectByStartDate(
  project: Pick<Project, "status" | "startDate">,
  today: string = toLocalDateOnly()
): boolean {
  if (project.status !== "planned") {
    return false
  }

  const startDate = project.startDate?.trim() ?? ""
  if (!startDate) {
    return false
  }

  return startDate <= today
}

export function buildAutoActivateHistoryDescription(
  previousStatus: ProjectStatus = "planned"
): string {
  return `Estado actualizado de ${PROJECT_STATUS_LABELS[previousStatus]} a ${PROJECT_STATUS_LABELS.active} por fecha de inicio.`
}
