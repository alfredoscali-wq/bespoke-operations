import type { TaskIncidentStatus } from "@/lib/types/task-incidents"

export const INCIDENT_SUPERVISOR_ACTIONS = {
  REQUEST_INFO: "request-info",
  CONTINUE: "continue",
  RESCHEDULE: "reschedule",
  CANCEL_TASK: "cancel-task",
} as const

export type IncidentSupervisorAction =
  (typeof INCIDENT_SUPERVISOR_ACTIONS)[keyof typeof INCIDENT_SUPERVISOR_ACTIONS]

export const INCIDENT_SUPERVISOR_EVENT_TYPES = new Set<string>([
  "REQUEST_INFO",
  "CONTINUE",
  "RESCHEDULE",
  "CANCEL_TASK",
])

export function mapIncidentEventTypeToSupervisorAction(
  eventType: string
): IncidentSupervisorAction | null {
  switch (eventType.trim()) {
    case "REQUEST_INFO":
      return INCIDENT_SUPERVISOR_ACTIONS.REQUEST_INFO
    case "CONTINUE":
      return INCIDENT_SUPERVISOR_ACTIONS.CONTINUE
    case "RESCHEDULE":
      return INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE
    case "CANCEL_TASK":
      return INCIDENT_SUPERVISOR_ACTIONS.CANCEL_TASK
    default:
      return null
  }
}

export function shouldRecordIncidentSupervisorAudit(eventType: string): boolean {
  return INCIDENT_SUPERVISOR_EVENT_TYPES.has(eventType.trim())
}

export function shouldRecordIncidentClosedAudit(input: {
  auditExplicitClosure?: boolean
  status: TaskIncidentStatus
}): boolean {
  return (
    input.auditExplicitClosure === true &&
    (input.status === "RESUELTA" || input.status === "RECHAZADA")
  )
}

export function resolveIncidentAuditEntityLabel(input: {
  taskCode?: string | null
  incidentId: string
}): string {
  const taskCode = input.taskCode?.trim()
  if (taskCode) {
    return taskCode
  }

  return `Incidencia ${input.incidentId.slice(0, 8)}`
}

export function resolveTaskCodeFromTask(input: {
  workOrderNumber?: string | null
  code?: string | null
  title?: string | null
}): string | null {
  return (
    input.workOrderNumber?.trim() ||
    input.code?.trim() ||
    input.title?.trim() ||
    null
  )
}

export function resolveSupervisorActionResultStatus(
  supervisorAction: IncidentSupervisorAction,
  previousStatus: TaskIncidentStatus
): TaskIncidentStatus | null {
  switch (supervisorAction) {
    case INCIDENT_SUPERVISOR_ACTIONS.REQUEST_INFO:
      return previousStatus === "REPORTADA" ? "EN_ANALISIS" : previousStatus
    case INCIDENT_SUPERVISOR_ACTIONS.CONTINUE:
      return "RESUELTA"
    case INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE:
      return previousStatus === "REPORTADA" ? "EN_ANALISIS" : previousStatus
    case INCIDENT_SUPERVISOR_ACTIONS.CANCEL_TASK:
      return "RECHAZADA"
    default:
      return null
  }
}

export function buildIncidentSupervisorActionDescription(
  supervisorAction: IncidentSupervisorAction,
  taskCode?: string | null
): string {
  const otSuffix = taskCode?.trim() ? ` (${taskCode.trim()})` : ""

  switch (supervisorAction) {
    case INCIDENT_SUPERVISOR_ACTIONS.REQUEST_INFO:
      return `Supervisor solicitó información${otSuffix}.`
    case INCIDENT_SUPERVISOR_ACTIONS.CONTINUE:
      return `Supervisor continuó la OT${otSuffix}.`
    case INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE:
      return `Supervisor replanificó la OT${otSuffix}.`
    case INCIDENT_SUPERVISOR_ACTIONS.CANCEL_TASK:
      return `Supervisor canceló la OT${otSuffix}.`
    default:
      return `Acción de supervisor sobre incidencia${otSuffix}.`
  }
}

export function buildIncidentClosedDescription(
  closureResult: TaskIncidentStatus,
  taskCode?: string | null
): string {
  const otSuffix = taskCode?.trim() ? ` (${taskCode.trim()})` : ""

  if (closureResult === "RECHAZADA") {
    return `Incidencia cerrada como rechazada${otSuffix}.`
  }

  return `Incidencia cerrada como resuelta${otSuffix}.`
}

export function buildIncidentCreatedDescription(taskCode?: string | null): string {
  const otSuffix = taskCode?.trim() ? ` (${taskCode.trim()})` : ""
  return `Incidencia reportada${otSuffix}.`
}

export type IncidentAuditMetadataBase = {
  incidentId: string
  taskId: string
  taskCode: string | null
  incidentTypeId: string
  incidentTypeLabel?: string | null
  incidentTypeCode?: string | null
}

export function buildIncidentCreatedMetadata(input: {
  incidentId: string
  taskId: string
  taskCode: string | null
  incidentTypeId: string
  incidentTypeLabel?: string | null
  incidentTypeCode?: string | null
  comment?: string | null
  employeeId: string
  employeeName?: string | null
  crewId?: string | null
  workTeamId?: string | null
  mobileDeviceId?: string | null
}): Record<string, unknown> {
  return {
    incidentId: input.incidentId,
    taskId: input.taskId,
    taskCode: input.taskCode,
    incidentTypeId: input.incidentTypeId,
    incidentTypeLabel: input.incidentTypeLabel ?? null,
    incidentTypeCode: input.incidentTypeCode ?? null,
    comment: input.comment ?? null,
    employeeId: input.employeeId,
    employeeName: input.employeeName ?? null,
    crewId: input.crewId ?? null,
    source: "mobile-field-agent",
    workTeamId: input.workTeamId ?? null,
    mobileDeviceId: input.mobileDeviceId ?? null,
  }
}

export function buildIncidentSupervisorActionMetadata(input: {
  base: IncidentAuditMetadataBase
  supervisorAction: IncidentSupervisorAction
  previousIncidentStatus: TaskIncidentStatus
  nextIncidentStatus: TaskIncidentStatus | null
  actorEmployeeId: string
  actorName: string
  note?: string | null
  previousDueDate?: string | null
  newDueDate?: string | null
  previousCrewId?: string | null
  newCrewId?: string | null
  previousCrewName?: string | null
  newCrewName?: string | null
}): Record<string, unknown> {
  return {
    ...input.base,
    supervisorAction: input.supervisorAction,
    previousIncidentStatus: input.previousIncidentStatus,
    nextIncidentStatus: input.nextIncidentStatus,
    actorEmployeeId: input.actorEmployeeId,
    actorName: input.actorName,
    note: input.note ?? null,
    source: "operations",
    ...(input.previousDueDate !== undefined
      ? { previousDueDate: input.previousDueDate }
      : {}),
    ...(input.newDueDate !== undefined ? { newDueDate: input.newDueDate } : {}),
    ...(input.previousCrewId !== undefined
      ? { previousCrewId: input.previousCrewId }
      : {}),
    ...(input.newCrewId !== undefined ? { newCrewId: input.newCrewId } : {}),
    ...(input.previousCrewName !== undefined
      ? { previousCrewName: input.previousCrewName }
      : {}),
    ...(input.newCrewName !== undefined ? { newCrewName: input.newCrewName } : {}),
  }
}

export function buildIncidentClosedMetadata(input: {
  base: IncidentAuditMetadataBase
  closureResult: TaskIncidentStatus
  previousIncidentStatus: TaskIncidentStatus
  actorEmployeeId: string
  actorName: string
  note?: string | null
}): Record<string, unknown> {
  return {
    ...input.base,
    closureResult: input.closureResult,
    previousIncidentStatus: input.previousIncidentStatus,
    actorEmployeeId: input.actorEmployeeId,
    actorName: input.actorName,
    note: input.note ?? null,
    source: "operations",
  }
}

export function resolveIncidentAuditDisplayDescription(entry: {
  action: string
  description: string
  metadata: Record<string, unknown>
}): string {
  if (entry.action === "INCIDENT_SUPERVISOR_ACTION") {
    const supervisorAction = entry.metadata.supervisorAction
    if (typeof supervisorAction === "string") {
      const mapped = mapIncidentEventTypeToSupervisorAction(
        supervisorAction === "request-info"
          ? "REQUEST_INFO"
          : supervisorAction === "continue"
            ? "CONTINUE"
            : supervisorAction === "reschedule"
              ? "RESCHEDULE"
              : supervisorAction === "cancel-task"
                ? "CANCEL_TASK"
                : supervisorAction
      )

      if (mapped) {
        const taskCode =
          typeof entry.metadata.taskCode === "string"
            ? entry.metadata.taskCode
            : null
        return buildIncidentSupervisorActionDescription(mapped, taskCode)
      }
    }
  }

  if (entry.action === "INCIDENT_CLOSED") {
    const closureResult = entry.metadata.closureResult
    const taskCode =
      typeof entry.metadata.taskCode === "string" ? entry.metadata.taskCode : null

    if (closureResult === "RESUELTA" || closureResult === "RECHAZADA") {
      return buildIncidentClosedDescription(closureResult, taskCode)
    }
  }

  if (entry.action === "INCIDENT_CREATED") {
    const taskCode =
      typeof entry.metadata.taskCode === "string" ? entry.metadata.taskCode : null
    return buildIncidentCreatedDescription(taskCode)
  }

  return entry.description
}
