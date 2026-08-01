/**
 * Planning-shaped helpers for crew production OT classification.
 * Mirrors Planning Read Model concepts without importing Planning UI.
 */

import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"
import { planningRepository } from "@/lib/engines/planning/repositories/PlanningRepository"
import type { CrewProductionSourceTask } from "@/lib/analysis/crew-production/types"

const FINISHED_STATUSES = new Set(["finalizada", "cerrada"])
const PENDING_STATUSES = new Set([
  "asignada",
  "programada",
  "en-curso",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
])

export function isFinishedOt(status: string): boolean {
  return FINISHED_STATUSES.has(status)
}

export function isPendingOt(status: string): boolean {
  return PENDING_STATUSES.has(status)
}

export function isCancelledOt(status: string): boolean {
  return status === "cancelada"
}

export function isRescheduledOt(task: CrewProductionSourceTask): boolean {
  const meta = task.taskMetadata ?? {}
  return Boolean(
    meta.rescheduleReason ||
      meta.rescheduledAt ||
      meta.originalScheduledDate
  )
}

export function taskDurationMinutes(task: CrewProductionSourceTask): number {
  return parseEstimatedDurationMinutes(task.estimatedDuration ?? "")
}

export function taskTravelDistanceMeters(
  task: CrewProductionSourceTask
): number {
  const travel = planningRepository.readTravelFromPrevious(task.taskMetadata)
  const ret = planningRepository.readReturnToBase(task.taskMetadata)
  return (travel.distanceMeters ?? 0) + (ret.distanceMeters ?? 0)
}

export function workOrderLabel(task: CrewProductionSourceTask): string {
  const code = task.code?.trim()
  const title = task.title?.trim()
  if (code && title) return `${code} · ${title}`
  return code || title || "Orden de trabajo"
}
