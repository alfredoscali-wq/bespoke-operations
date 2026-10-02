import type { SessionUser } from "@/lib/auth/types"
import { compareDateOnly, toLocalDateOnly } from "@/lib/dates/date-only"
import { canAccessObrasModuleForStart } from "@/lib/projects/obra-task-insert-integrity"
import {
  LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE,
  loadLiveCompanyTask,
  type LiveCompanyTaskLookup,
} from "@/lib/tasks/live-company-task"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export { LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE }

/** OT statuses that can be rescheduled from Obra detail (not finalized). */
export const PROJECT_TASK_RESCHEDULE_STATUSES: TaskStatus[] = [
  "programada",
  "asignada",
  "vencida",
  "incidencia",
]

export function canRescheduleProjectTask(
  task: Pick<Task, "projectId" | "status">
): boolean {
  if (!task.projectId) {
    return false
  }

  return PROJECT_TASK_RESCHEDULE_STATUSES.includes(task.status)
}

export function canRescheduleProjectTaskFromSession(
  sessionUser: Pick<
    SessionUser,
    "systemRole" | "roleCode" | "moduleVisibility"
  > | null | undefined,
  task: Pick<Task, "projectId" | "status">
): boolean {
  return (
    canAccessObrasModuleForStart(sessionUser) && canRescheduleProjectTask(task)
  )
}

/**
 * Keep crew and operational assignment.
 * Only lift overdue/incident back into an executable scheduled status.
 */
export function resolveProjectTaskRescheduleTargetStatus(
  task: Pick<Task, "status" | "crewId" | "crew">
): TaskStatus {
  const hasCrew = Boolean(task.crewId?.trim() || task.crew?.trim())

  if (task.status === "vencida" || task.status === "incidencia") {
    return hasCrew ? "asignada" : "programada"
  }

  return task.status
}

export function getProjectTaskRescheduleBlockedMessage(
  task: Pick<Task, "projectId" | "status">
): string | null {
  if (!task.projectId) {
    return "Solo se pueden reprogramar órdenes de trabajo de una obra."
  }

  if (task.status === "finalizada") {
    return "No se puede reprogramar una orden de trabajo finalizada."
  }

  if (task.status === "cancelada") {
    return "No se puede reprogramar una orden de trabajo cancelada."
  }

  if (!canRescheduleProjectTask(task)) {
    return "Esta orden de trabajo no puede reprogramarse en su estado actual."
  }

  return null
}

/**
 * Date picker default: if the current due date is already overdue, start on
 * local today so the form is submittable without a past calendar value.
 */
export function resolveProjectTaskRescheduleInitialDueDate(
  task: Pick<Task, "dueDate">,
  referenceDate: Date = new Date()
): string {
  const today = toLocalDateOnly(referenceDate)
  const current = task.dueDate?.trim() ?? ""
  if (!current || compareDateOnly(current, today) < 0) {
    return today
  }
  return current
}

export function resolveRescheduleSourceTask(input: {
  id: string
  loadedTask?: Task | null
  providerTasks?: readonly Task[] | null
}): Task | null {
  if (input.loadedTask?.id === input.id) {
    return input.loadedTask
  }

  return input.providerTasks?.find((item) => item.id === input.id) ?? null
}

/**
 * Prefer the OT already on screen (Obra tab or provider), then the live
 * company-scoped row. Never invents a new OT.
 */
export async function loadProjectTaskForReschedule(
  taskId: string,
  companyId: string,
  options: {
    loadedTask?: Task | null
    providerTasks?: readonly Task[] | null
    loadLiveTask: LiveCompanyTaskLookup
  }
): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
  const fromSource = resolveRescheduleSourceTask({
    id: taskId,
    loadedTask: options.loadedTask,
    providerTasks: options.providerTasks,
  })
  if (fromSource) {
    return { ok: true, task: fromSource }
  }

  return loadLiveCompanyTask(taskId, companyId, {
    loadLiveTask: options.loadLiveTask,
  })
}

/** Obra reschedule may only change schedule/status fields — not identity. */
export function assertProjectTaskReschedulePayloadSafe(
  payload: UpdateTaskPayload
): boolean {
  return (
    payload.projectId === undefined &&
    payload.code === undefined &&
    payload.crewId === undefined &&
    payload.crew === undefined &&
    payload.checklist === undefined &&
    payload.operationalSteps === undefined
  )
}
