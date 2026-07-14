import type {
  Task,
  TaskDetail,
  TaskEvidence,
  TaskHistoryEvent,
} from "@/lib/types/tasks"
import { readTrabajoRealizadoFromTask } from "@/lib/tasks/trabajo-realizado"

export const PLANNING_PENDING_CLOSURE_DETAIL_SECTIONS = [
  "ot",
  "execution",
  "history",
] as const

export const PLANNING_PENDING_CLOSURE_TASK_CONTEXT_FIELDS = [
  "taskCode",
  "workTitle",
  "customer",
  "crew",
  "operator",
] as const

export const PLANNING_PENDING_CLOSURE_REMOVED_DETAIL_BLOCKS = [
  "TaskAdminDetailView",
  "TaskAdminInfoPanel",
  "TaskAdminSidebarPanel",
  "TaskAdminReferencePhotos",
  "TaskAdminDetailHeader",
  "commercialMetrics",
  "gpsLocation",
  "planningSchedule",
  "adminExpediente",
] as const

export const PLANNING_PENDING_CLOSURE_EXECUTION_BLOCKS = [
  "operationalChecklist",
  "technicianObservations",
  "operationalEvidences",
] as const

export const PLANNING_PENDING_CLOSURE_SUPERVISOR_ACTIONS = [
  "Solicitar corrección",
  "Aprobar y cerrar",
] as const

export const PLANNING_PENDING_CLOSURE_BRIEF_HISTORY_LIMIT = 5

export const PLANNING_PENDING_CLOSURE_DETAIL_LOAD_ERROR =
  "No fue posible cargar el detalle de la OT."

export function selectPendingClosureBriefHistory(
  history: TaskHistoryEvent[],
  limit: number = PLANNING_PENDING_CLOSURE_BRIEF_HISTORY_LIMIT
): TaskHistoryEvent[] {
  return [...history]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, limit)
}

export function resolvePendingClosureTechnicianObservations(
  task: Pick<Task, "operationalSteps" | "taskMetadata">,
  detail?: Pick<TaskDetail, "comments">
): string | null {
  const trabajoRealizado = readTrabajoRealizadoFromTask(task)
  if (trabajoRealizado) {
    return trabajoRealizado
  }

  const stepObservations = (task.operationalSteps ?? [])
    .map((step) => step.observation?.trim())
    .filter((value): value is string => Boolean(value))

  if (stepObservations.length > 0) {
    return stepObservations.join("\n\n")
  }

  const technicianComments = (detail?.comments ?? [])
    .filter((comment) => comment.role === "operario")
    .map((comment) => comment.content.trim())
    .filter(Boolean)

  if (technicianComments.length > 0) {
    return technicianComments.join("\n\n")
  }

  return null
}

export function selectPendingClosureOperationalEvidences(
  evidence: TaskEvidence[]
): TaskEvidence[] {
  return evidence.filter((item) => item.type !== "photo")
}
