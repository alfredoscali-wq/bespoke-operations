export type OperationalMotivoKind = "cancelacion" | "reprogramacion"

export type OperationalMotivo = {
  id: string
  companyId: string
  kind: OperationalMotivoKind
  code: string
  label: string
  description: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type OperationalMotivoInput = {
  kind: OperationalMotivoKind
  label: string
  description?: string
  isActive?: boolean
}

export type TaskOperationalEventType =
  | "created"
  | "planning_confirmed"
  | "assigned"
  | "rescheduled"
  | "started"
  | "checklist_completed"
  | "trabajo_realizado"
  | "incident_created"
  | "incident_resolved"
  | "pending_closure"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed"
  | "overdue"
  | "note"

export type TaskOperationalEvent = {
  id: string
  companyId: string
  taskId: string
  eventType: TaskOperationalEventType | string
  title: string
  description: string
  observations: string
  actorUserId: string | null
  actorEmployeeId: string | null
  actorDisplayName: string
  payload: Record<string, unknown>
  occurredAt: string
  createdAt: string
}

export type TaskOperationalEventInsert = {
  companyId: string
  taskId: string
  eventType: TaskOperationalEventType | string
  title: string
  description?: string
  observations?: string
  actorUserId?: string | null
  actorEmployeeId?: string | null
  actorDisplayName?: string
  payload?: Record<string, unknown>
  occurredAt?: string
}
