/**
 * OPS 2.4 — resolve Obra OT incidents from Planning > Obras activas.
 * Does not use operational replan / task_incidents supervisor flow.
 */

import { compareDateOnly } from "@/lib/dates/date-only"
import { mergeMaterialsNeededIntoMetadata } from "@/lib/tasks/work-order"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

export const PROJECT_TASK_INCIDENT_RESOLVE_DECISIONS = [
  "return-to-programmed",
  "keep-incident",
] as const

export type ProjectTaskIncidentResolveDecision =
  (typeof PROJECT_TASK_INCIDENT_RESOLVE_DECISIONS)[number]

export type ProjectTaskIncidentResolveInput = {
  decision: ProjectTaskIncidentResolveDecision
  observationsForCrew: string
  materialsNeeded: string
  startDate: string
  dueDate: string
}

export function canResolveProjectTaskIncidentFromPlanning(
  task: Pick<Task, "projectId" | "status">
): boolean {
  return Boolean(task.projectId?.trim()) && task.status === "incidencia"
}

export function validateProjectTaskIncidentResolveInput(
  input: ProjectTaskIncidentResolveInput
): { ok: true } | { ok: false; message: string } {
  const startDate = input.startDate.trim()
  const dueDate = input.dueDate.trim()

  if (!startDate || !dueDate) {
    return {
      ok: false,
      message: "Indique fecha de inicio y fecha de fin.",
    }
  }

  if (compareDateOnly(startDate, dueDate) > 0) {
    return {
      ok: false,
      message: "La fecha de inicio no puede ser posterior a la fecha de fin.",
    }
  }

  if (
    !PROJECT_TASK_INCIDENT_RESOLVE_DECISIONS.includes(input.decision)
  ) {
    return { ok: false, message: "Seleccione una decisión válida." }
  }

  return { ok: true }
}

export function buildProjectTaskIncidentResolvePayload(
  task: Pick<Task, "taskMetadata" | "projectId" | "status">,
  input: ProjectTaskIncidentResolveInput
): UpdateTaskPayload {
  const payload: UpdateTaskPayload = {
    observationsForCrew: input.observationsForCrew.trim(),
    startDate: input.startDate.trim(),
    dueDate: input.dueDate.trim(),
    taskMetadata: mergeMaterialsNeededIntoMetadata(
      task.taskMetadata,
      input.materialsNeeded.trim()
    ),
  }

  if (input.decision === "return-to-programmed") {
    payload.status = "programada"
  }

  return payload
}

export function assertProjectTaskIncidentResolvePayloadSafe(
  payload: UpdateTaskPayload
): boolean {
  if ("executionOrder" in payload && payload.executionOrder !== undefined) {
    return false
  }
  if ("dispatchOrder" in payload && payload.dispatchOrder !== undefined) {
    return false
  }
  if ("projectId" in payload && payload.projectId !== undefined) {
    return false
  }
  return true
}

export function formatProjectTaskIncidentResolveHistoryNote(
  input: ProjectTaskIncidentResolveInput,
  options?: { actor?: string }
): string {
  const actor = options?.actor?.trim()
  const prefix = actor ? `${actor}: ` : ""
  const range = `${input.startDate.trim()} → ${input.dueDate.trim()}`

  if (input.decision === "return-to-programmed") {
    return `${prefix}Incidencia de Obra resuelta → programada. Rango ${range}.`
  }

  return `${prefix}Incidencia de Obra mantenida con ajustes. Rango ${range}.`
}
