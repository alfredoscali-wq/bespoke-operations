import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"

export const PLANNING_RETURN_METADATA_KEYS = {
  reason: "planningReturnReason",
  at: "planningReturnAt",
  by: "planningReturnBy",
  previousCrewId: "planningReturnPreviousCrewId",
  previousCrewName: "planningReturnPreviousCrewName",
  previousDueDate: "planningReturnPreviousDueDate",
  previousScheduledTime: "planningReturnPreviousScheduledTime",
} as const

export type PlanningReturnInfo = {
  reason: string
  returnedAt: string
  returnedBy: string
  previousCrewId: string | null
  previousCrewName: string | null
  previousDueDate: string | null
  previousScheduledTime: string | null
}

const RETURNABLE_PLANNING_STATUSES = new Set<TaskStatus>([
  "programada",
  "asignada",
  "vencida",
])

export function canReturnPlanningTaskToAtencion(
  task: Pick<Task, "status" | "projectCode" | "serviceType">
): boolean {
  return (
    isWorkOrderTask(task) && RETURNABLE_PLANNING_STATUSES.has(task.status)
  )
}

export function hasActivePlanningReturn(
  task: Pick<Task, "taskMetadata">
): boolean {
  return Boolean(readPlanningReturnInfo(task))
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string {
  const value = metadata?.[key]
  return typeof value === "string" ? value.trim() : ""
}

export function readPlanningReturnInfo(
  task: Pick<Task, "taskMetadata">
): PlanningReturnInfo | null {
  const metadata = task.taskMetadata
  const reason = readMetadataString(metadata, PLANNING_RETURN_METADATA_KEYS.reason)
  const returnedAt = readMetadataString(metadata, PLANNING_RETURN_METADATA_KEYS.at)
  const returnedBy = readMetadataString(metadata, PLANNING_RETURN_METADATA_KEYS.by)

  if (!reason || !returnedAt || !returnedBy) {
    return null
  }

  const previousCrewId = readMetadataString(
    metadata,
    PLANNING_RETURN_METADATA_KEYS.previousCrewId
  )
  const previousCrewName = readMetadataString(
    metadata,
    PLANNING_RETURN_METADATA_KEYS.previousCrewName
  )
  const previousDueDate = readMetadataString(
    metadata,
    PLANNING_RETURN_METADATA_KEYS.previousDueDate
  )
  const previousScheduledTime = readMetadataString(
    metadata,
    PLANNING_RETURN_METADATA_KEYS.previousScheduledTime
  )

  return {
    reason,
    returnedAt,
    returnedBy,
    previousCrewId: previousCrewId || null,
    previousCrewName: previousCrewName || null,
    previousDueDate: previousDueDate || null,
    previousScheduledTime: previousScheduledTime || null,
  }
}

export function buildPlanningReturnMetadata(
  task: Task,
  input: { reason: string; returnedBy: string }
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(task.taskMetadata ?? {}) }

  next[PLANNING_RETURN_METADATA_KEYS.reason] = input.reason.trim()
  next[PLANNING_RETURN_METADATA_KEYS.at] = new Date().toISOString()
  next[PLANNING_RETURN_METADATA_KEYS.by] = input.returnedBy.trim()
  next[PLANNING_RETURN_METADATA_KEYS.previousCrewId] = task.crewId ?? ""
  next[PLANNING_RETURN_METADATA_KEYS.previousCrewName] = task.crew?.trim() ?? ""
  next[PLANNING_RETURN_METADATA_KEYS.previousDueDate] = task.dueDate ?? ""
  next[PLANNING_RETURN_METADATA_KEYS.previousScheduledTime] =
    task.scheduledTime ?? ""

  return next
}

export function clearPlanningReturnMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) }

  for (const key of Object.values(PLANNING_RETURN_METADATA_KEYS)) {
    delete next[key]
  }

  return next
}

export function shouldClearPlanningReturnOnScheduleUpdate(
  task: Pick<Task, "taskMetadata" | "startDate" | "dueDate">,
  nextDueDate: string | undefined
): boolean {
  if (!hasActivePlanningReturn(task) || nextDueDate === undefined) {
    return false
  }

  const normalizedDueDate = nextDueDate.trim()
  if (!normalizedDueDate) {
    return false
  }

  return normalizedDueDate !== task.startDate.trim()
}

export function validatePlanningReturnReason(
  reason: string
): { allowed: boolean; message?: string } {
  if (!reason.trim()) {
    return {
      allowed: false,
      message: "Indique el motivo de la devolución.",
    }
  }

  return { allowed: true }
}

export function buildPlanningReturnToAtencionUpdate(
  task: Task,
  input: { reason: string; returnedBy: string }
): UpdateTaskPayload {
  const needsStatusReset =
    task.status === "asignada" || task.status === "vencida"

  return {
    status: needsStatusReset ? "programada" : task.status,
    crewId: null,
    crew: "",
    supervisor: "",
    dueDate: task.startDate,
    startDate: task.startDate,
    scheduledTime: null,
    dispatchOrder: null,
    executionOrder: null,
    taskMetadata: buildPlanningReturnMetadata(task, input),
  }
}

export function countPlanningReturnedTasks(tasks: Task[]): number {
  return tasks.filter(hasActivePlanningReturn).length
}

export function filterPlanningReturnedTasks(tasks: Task[]): Task[] {
  return tasks.filter(hasActivePlanningReturn)
}
