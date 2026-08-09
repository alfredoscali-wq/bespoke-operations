import { compareDateOnly, toLocalDateOnly } from "@/lib/dates/date-only"
import { isTaskVencida } from "@/lib/tasks/vencida-status"
import type { Task, TaskStatus } from "@/lib/types/tasks"

/** OT activas en campo — visibles sin restricción de fecha. */
const FIELD_AGENT_ACTIVE_STATUSES: TaskStatus[] = [
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
]

/**
 * OPS 2.5: Field Agent solo consume OT liberadas (asignada) o en ejecución.
 * Obra programada = pendiente de envío — no aparece en agenda.
 */
const FIELD_AGENT_SCHEDULED_STATUSES: TaskStatus[] = ["asignada"]

const FIELD_AGENT_OVERDUE_STATUSES: TaskStatus[] = ["vencida"]

/** Statuses fetched for Field Agent agenda (filtered in memory by visibility rules). */
export const FIELD_AGENT_AGENDA_QUERY_STATUSES: TaskStatus[] = [
  ...FIELD_AGENT_ACTIVE_STATUSES,
  ...FIELD_AGENT_SCHEDULED_STATUSES,
  ...FIELD_AGENT_OVERDUE_STATUSES,
]

function resolveOperationalStartDate(
  task: Pick<Task, "dueDate"> & Partial<Pick<Task, "startDate">>
): string {
  const startDate = task.startDate?.trim()
  if (startDate) {
    return startDate
  }

  return task.dueDate
}

/**
 * OT asignada visible when today falls within [startDate, dueDate] (inclusive).
 * Single-day OTs (start === due) behave as before.
 * OPS 2.5: today >= start_date (and today <= due_date).
 */
export function isOperationalDateRangeActive(
  task: Pick<Task, "dueDate"> & Partial<Pick<Task, "startDate">>,
  referenceDate: string = toLocalDateOnly()
): boolean {
  const startDate = resolveOperationalStartDate(task)
  const dueDate = task.dueDate

  return (
    compareDateOnly(startDate, referenceDate) <= 0 &&
    compareDateOnly(referenceDate, dueDate) <= 0
  )
}

export function isFieldAgentAgendaTaskVisible(
  task: Pick<Task, "status" | "dueDate" | "taskMetadata"> &
    Partial<Pick<Task, "startDate" | "projectId" | "crewId" | "crew">>,
  referenceDate: string = toLocalDateOnly()
): boolean {
  if (FIELD_AGENT_ACTIVE_STATUSES.includes(task.status)) {
    return true
  }

  if (isTaskVencida(task)) {
    return true
  }

  if (FIELD_AGENT_SCHEDULED_STATUSES.includes(task.status)) {
    return isOperationalDateRangeActive(task, referenceDate)
  }

  return false
}
