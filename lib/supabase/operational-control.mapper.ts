import type {
  OperationalMotivo,
  OperationalMotivoKind,
  TaskOperationalEvent,
  TaskOperationalEventInsert,
} from "@/lib/types/operational-control"

export type OperationalMotivoRow = {
  id: string
  company_id: string
  kind: string
  code: string
  label: string
  description: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type TaskOperationalEventRow = {
  id: string
  company_id: string
  task_id: string
  event_type: string
  title: string
  description: string
  observations: string
  actor_user_id: string | null
  actor_employee_id: string | null
  actor_display_name: string
  payload: Record<string, unknown> | null
  occurred_at: string
  created_at: string
}

export function mapOperationalMotivoRow(
  row: OperationalMotivoRow
): OperationalMotivo {
  return {
    id: row.id,
    companyId: row.company_id,
    kind: row.kind as OperationalMotivoKind,
    code: row.code,
    label: row.label,
    description: row.description ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapTaskOperationalEventRow(
  row: TaskOperationalEventRow
): TaskOperationalEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    taskId: row.task_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description ?? "",
    observations: row.observations ?? "",
    actorUserId: row.actor_user_id,
    actorEmployeeId: row.actor_employee_id,
    actorDisplayName: row.actor_display_name ?? "",
    payload: (row.payload ?? {}) as Record<string, unknown>,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

export function mapTaskOperationalEventInsert(
  input: TaskOperationalEventInsert
): Record<string, unknown> {
  return {
    company_id: input.companyId,
    task_id: input.taskId,
    event_type: input.eventType,
    title: input.title,
    description: input.description ?? "",
    observations: input.observations ?? "",
    actor_user_id: input.actorUserId ?? null,
    actor_employee_id: input.actorEmployeeId ?? null,
    actor_display_name: input.actorDisplayName ?? "",
    payload: input.payload ?? {},
    ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
  }
}
