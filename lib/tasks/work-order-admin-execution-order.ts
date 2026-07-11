import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

import { resolveNextPlanningQueuePosition } from "@/lib/planificacion/planning-dynamic"

export function resolveAdminWorkOrderExecutionOrderDestination(
  existing: Pick<Task, "crewId" | "dueDate">,
  payload: Pick<UpdateTaskPayload, "crewId" | "dueDate">
): { crewId: string; dueDate: string } | null {
  const nextCrewId =
    payload.crewId !== undefined
      ? payload.crewId?.trim() || null
      : existing.crewId?.trim() || null
  const nextDueDate =
    payload.dueDate !== undefined
      ? payload.dueDate?.trim() || null
      : existing.dueDate?.trim() || null

  if (!nextCrewId || !nextDueDate) {
    return null
  }

  return { crewId: nextCrewId, dueDate: nextDueDate }
}

export function shouldRecalculateAdminWorkOrderExecutionOrder(
  existing: Pick<Task, "status" | "crewId" | "dueDate">,
  payload: Pick<UpdateTaskPayload, "crewId" | "dueDate">
): boolean {
  if (existing.status !== "programada") {
    return false
  }

  const destination = resolveAdminWorkOrderExecutionOrderDestination(
    existing,
    payload
  )
  if (!destination) {
    return false
  }

  const crewChanged =
    (existing.crewId?.trim() || null) !== destination.crewId
  const dateChanged =
    (existing.dueDate?.trim() || null) !== destination.dueDate

  return crewChanged || dateChanged
}

export function computeNextExecutionOrderFromMax(
  maxExecutionOrder: number | null | undefined
): number {
  return Math.max(0, maxExecutionOrder ?? 0) + 1
}

export function resolveFirstAvailableExecutionOrderForScope(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  excludeTaskId?: string
}): number {
  return resolveNextPlanningQueuePosition(input)
}

export function buildAdminWorkOrderPatchPayload(
  fieldsOnly: UpdateTaskPayload,
  authoritativeExecutionOrder: number | undefined
): UpdateTaskPayload {
  if (authoritativeExecutionOrder !== undefined) {
    return { ...fieldsOnly, executionOrder: authoritativeExecutionOrder }
  }

  const { executionOrder: _clientIgnored, ...rest } = fieldsOnly
  return rest
}
