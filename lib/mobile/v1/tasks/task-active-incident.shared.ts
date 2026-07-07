import type { TaskStatus } from "@/lib/types/tasks"

export const MOBILE_TASK_BLOCKED_BY_ACTIVE_INCIDENT_MESSAGE =
  "La orden de trabajo está suspendida por una incidencia activa. Espere la resolución del supervisor."

export function isTaskExecutionBlockedByActiveIncident(input: {
  taskStatus: TaskStatus
  hasActiveIncident: boolean
}): boolean {
  return input.taskStatus === "en-curso" && input.hasActiveIncident
}

export function resolveMobileTaskHasActiveIncident(input: {
  taskStatus: TaskStatus
  hasActiveIncidentRecord: boolean
}): boolean {
  return isTaskExecutionBlockedByActiveIncident({
    taskStatus: input.taskStatus,
    hasActiveIncident: input.hasActiveIncidentRecord,
  })
}

export function resolveMobileTaskHasActiveIncidentFromTaskSet(input: {
  taskId: string
  taskStatus: TaskStatus
  activeIncidentTaskIds: ReadonlySet<string>
}): boolean {
  return resolveMobileTaskHasActiveIncident({
    taskStatus: input.taskStatus,
    hasActiveIncidentRecord: input.activeIncidentTaskIds.has(input.taskId),
  })
}
