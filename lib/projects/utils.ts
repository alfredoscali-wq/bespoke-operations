import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import type { ProjectStatus } from "@/lib/types/projects"

const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  planned: ["active"],
  active: ["pending-closure"],
  paused: [],
  "pending-closure": ["closed"],
  closed: [],
}

export function canTransitionProjectStatus(
  currentStatus: ProjectStatus,
  newStatus: ProjectStatus
): { allowed: boolean; message?: string } {
  if (currentStatus === newStatus) {
    return {
      allowed: false,
      message: "La obra ya está en ese estado.",
    }
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? []

  if (!allowedNext.includes(newStatus)) {
    return {
      allowed: false,
      message: `No se puede cambiar de ${PROJECT_STATUS_LABELS[currentStatus]} a ${PROJECT_STATUS_LABELS[newStatus]}.`,
    }
  }

  return { allowed: true }
}

export function getProjectLifecycleAction(
  currentStatus: ProjectStatus
): { label: string; nextStatus: ProjectStatus } | null {
  switch (currentStatus) {
    case "planned":
      return { label: "Iniciar Obra", nextStatus: "active" }
    case "active":
      return { label: "Solicitar Cierre", nextStatus: "pending-closure" }
    case "pending-closure":
      return { label: "Cerrar Obra", nextStatus: "closed" }
    default:
      return null
  }
}
