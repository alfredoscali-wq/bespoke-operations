import type { TaskIncidentStatus } from "@/lib/types/task-incidents"

import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"

export const ACTIVE_TASK_INCIDENT_STATUSES: TaskIncidentStatus[] = [
  "REPORTADA",
  "EN_ANALISIS",
]

export const TERMINAL_TASK_INCIDENT_STATUSES: TaskIncidentStatus[] = [
  "RESUELTA",
  "RECHAZADA",
]

const ALLOWED_TRANSITIONS: Record<
  TaskIncidentStatus,
  readonly TaskIncidentStatus[]
> = {
  REPORTADA: ["EN_ANALISIS"],
  EN_ANALISIS: ["RESUELTA", "RECHAZADA"],
  RESUELTA: [],
  RECHAZADA: [],
}

export function isTaskIncidentStatus(value: string): value is TaskIncidentStatus {
  return (
    value === "REPORTADA" ||
    value === "EN_ANALISIS" ||
    value === "RESUELTA" ||
    value === "RECHAZADA"
  )
}

export function assertValidStatusTransition(
  currentStatus: TaskIncidentStatus,
  nextStatus: TaskIncidentStatus
): void {
  if (currentStatus === nextStatus) {
    throw new TaskIncidentError(
      "INVALID_STATUS",
      "La incidencia ya se encuentra en ese estado.",
      409
    )
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus]

  if (!allowed.includes(nextStatus)) {
    throw new TaskIncidentError(
      "INVALID_STATUS",
      `No se permite la transición de ${currentStatus} a ${nextStatus}.`,
      409
    )
  }
}

export function isTerminalTaskIncidentStatus(
  status: TaskIncidentStatus
): boolean {
  return TERMINAL_TASK_INCIDENT_STATUSES.includes(status)
}
