import type { TaskStatus } from "@/lib/types/tasks"

/** OT statuses exposed to Bespoke Field Agent (crew execution only). */
export const FIELD_AGENT_VISIBLE_TASK_STATUSES = [
  "asignada",
  "en-curso",
] as const satisfies readonly TaskStatus[]

export type FieldAgentVisibleTaskStatus =
  (typeof FIELD_AGENT_VISIBLE_TASK_STATUSES)[number]

export function isFieldAgentVisibleTaskStatus(
  status: TaskStatus
): status is FieldAgentVisibleTaskStatus {
  return (FIELD_AGENT_VISIBLE_TASK_STATUSES as readonly TaskStatus[]).includes(
    status
  )
}
