import type { TaskStatus } from "@/lib/types/tasks"

import { FIELD_AGENT_AGENDA_QUERY_STATUSES } from "@/lib/mobile/v1/agenda/agenda-task-visibility"

/** @deprecated Use FIELD_AGENT_AGENDA_QUERY_STATUSES from agenda-task-visibility. */
export const FIELD_AGENT_VISIBLE_TASK_STATUSES = FIELD_AGENT_AGENDA_QUERY_STATUSES

export type FieldAgentVisibleTaskStatus =
  (typeof FIELD_AGENT_AGENDA_QUERY_STATUSES)[number]

export function isFieldAgentVisibleTaskStatus(
  status: TaskStatus
): status is FieldAgentVisibleTaskStatus {
  return (FIELD_AGENT_AGENDA_QUERY_STATUSES as readonly TaskStatus[]).includes(
    status
  )
}
