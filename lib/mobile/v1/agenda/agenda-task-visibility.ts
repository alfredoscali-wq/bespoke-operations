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

const FIELD_AGENT_SCHEDULED_STATUSES: TaskStatus[] = ["asignada"]

const FIELD_AGENT_OVERDUE_STATUSES: TaskStatus[] = ["vencida"]

/** Statuses fetched for Field Agent agenda (filtered in memory by visibility rules). */
export const FIELD_AGENT_AGENDA_QUERY_STATUSES: TaskStatus[] = [
  ...FIELD_AGENT_ACTIVE_STATUSES,
  ...FIELD_AGENT_SCHEDULED_STATUSES,
  ...FIELD_AGENT_OVERDUE_STATUSES,
]

export function isFieldAgentAgendaTaskVisible(
  task: Pick<Task, "status" | "dueDate" | "taskMetadata">,
  referenceDate: string = toLocalDateOnly()
): boolean {
  if (FIELD_AGENT_ACTIVE_STATUSES.includes(task.status)) {
    return true
  }

  if (isTaskVencida(task)) {
    return true
  }

  if (FIELD_AGENT_SCHEDULED_STATUSES.includes(task.status)) {
    return compareDateOnly(task.dueDate, referenceDate) <= 0
  }

  return false
}
