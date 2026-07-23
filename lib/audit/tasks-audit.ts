import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import {
  buildAuditChangeMetadata,
  buildAuditFieldChanges,
  normalizeAuditValue,
} from "@/lib/audit/metadata-changes"
import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import {
  buildTaskCrewMetadata,
  buildTaskScheduleMetadata,
  buildTaskStatusMetadata,
  resolveTaskEntityLabel,
} from "@/lib/audit/tasks-audit-shared"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  type AuditAction,
} from "@/lib/audit/types"
import {
  recordTaskCreateActivity,
  recordTaskDeleteActivity,
  recordTaskMutationActivity,
} from "@/lib/activity/adapters/tasks-activity"
import { recordPlanningReturnActivity } from "@/lib/activity/adapters/planning-activity"
import { resolveRescheduleReasonLabel } from "@/lib/tasks/reschedule"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import type { TaskWorkflowAction } from "@/lib/tasks/task-status-workflow"
import type { Task } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"

export {
  buildTaskCrewMetadata,
  buildTaskScheduleMetadata,
  buildTaskStatusMetadata,
  buildTaskVencidaAuditMetadata,
  resolveTaskEntityLabel,
} from "@/lib/audit/tasks-audit-shared"

const TASK_UPDATE_FIELD_LABELS: Partial<Record<keyof UpdateTaskPayload, string>> = {
  code: "code",
  title: "title",
  description: "description",
  projectId: "projectId",
  projectCode: "projectCode",
  projectName: "projectName",
  customerCompany: "customerCompany",
  customerName: "customerName",
  customerPhone: "customerPhone",
  customerId: "customerId",
  serviceAddress: "serviceAddress",
  latitude: "latitude",
  longitude: "longitude",
  sharedLocation: "sharedLocation",
  observationsForCrew: "observationsForCrew",
  workOrderNumber: "workOrderNumber",
  type: "type",
  priority: "priority",
  estimatedDuration: "estimatedDuration",
  serviceType: "serviceType",
  locality: "locality",
  contractedPlan: "contractedPlan",
  installationCost: "installationCost",
  amountToCollect: "amountToCollect",
  rejectionReason: "rejectionReason",
  incidentReason: "incidentReason",
  incidentObservation: "incidentObservation",
  incidentReportedBy: "incidentReportedBy",
  cancellationReason: "cancellationReason",
  cancellationObservation: "cancellationObservation",
}

const TASK_GENERIC_UPDATE_FIELDS = Object.keys(
  TASK_UPDATE_FIELD_LABELS
) as (keyof UpdateTaskPayload)[]

const TASK_WORKFLOW_ONLY_FIELDS = new Set<keyof UpdateTaskPayload>([
  "status",
  "crewId",
  "crew",
  "supervisor",
  "dueDate",
  "startDate",
  "scheduledTime",
  "originalScheduledDate",
  "originalScheduledTime",
  "rescheduledBy",
  "rescheduledAt",
  "rescheduleReason",
  "rescheduleNotes",
  "incidentReportedAt",
])

function buildTaskGenericUpdateMetadata(before: Task, payload: UpdateTaskPayload) {
  const changes = buildAuditFieldChanges({
    before,
    updates: payload,
    fields: TASK_GENERIC_UPDATE_FIELDS.filter((field) => payload[field] !== undefined),
    labels: TASK_UPDATE_FIELD_LABELS,
  })

  return buildAuditChangeMetadata(changes)
}

function isCrewOnlyPayload(payload: UpdateTaskPayload): boolean {
  const keys = Object.keys(payload) as (keyof UpdateTaskPayload)[]
  if (keys.length === 0) {
    return false
  }

  return keys.every(
    (key) => key === "crewId" || key === "crew" || key === "supervisor"
  )
}

function withTaskWorkflowMetadata(
  metadata: Record<string, unknown>,
  workflowAction?: TaskWorkflowAction
) {
  if (!workflowAction) {
    return metadata
  }

  return {
    ...metadata,
    workflowAction,
  }
}

export function mapWorkflowActionToAuditAction(
  workflowAction: TaskWorkflowAction
): AuditAction | null {
  switch (workflowAction) {
    case "assign-crew":
      return AUDIT_ACTIONS.TASK_ASSIGN_CREW
    case "start":
    case "resume-from-incident":
      return AUDIT_ACTIONS.TASK_STATUS_EN_CURSO
    case "submit-for-approval":
      return AUDIT_ACTIONS.TASK_REQUEST_CLOSE
    case "reschedule-from-incident":
    case "reschedule-from-overdue":
    case "reschedule-planning-return":
    case "reschedule-from-active-incident":
    case "reschedule-obra":
      return AUDIT_ACTIONS.TASK_RESCHEDULE
    case "approve":
      return AUDIT_ACTIONS.TASK_FINISH
    default:
      return null
  }
}

function recordTaskAuditEvent(input: {
  action: AuditAction
  task: Pick<Task, "id" | "code" | "title" | "workOrderNumber">
  description?: string
  metadata?: Record<string, unknown>
  workflowAction?: TaskWorkflowAction
}) {
  const entityLabel = resolveTaskEntityLabel(input.task)

  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: input.action,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.task.id,
    entityLabel,
    description:
      input.description ??
      buildAuditDescription({
        action: input.action,
        entityLabel,
      }),
    metadata: withTaskWorkflowMetadata(input.metadata ?? {}, input.workflowAction),
  })
}

export function recordTaskCreateAudit(task: Task) {
  recordTaskAuditEvent({
    action: AUDIT_ACTIONS.TASK_CREATE,
    task,
    metadata: {
      code: task.code,
      status: task.status,
      dueDate: task.dueDate,
      scheduledTime: task.scheduledTime ?? null,
      crew: task.crew || null,
      crewId: task.crewId ?? null,
    },
  })
  recordTaskCreateActivity(task)
}

export function recordTaskUpdateAudit(
  before: Task,
  payload: UpdateTaskPayload,
  after: Task,
  options?: {
    workflowAction?: TaskWorkflowAction
    includeStatus?: boolean
    supplementalMetadata?: Record<string, unknown>
  }
) {
  const fieldMetadata = buildTaskGenericUpdateMetadata(before, payload)
  const metadata: Record<string, unknown> = {
    ...fieldMetadata,
    ...options?.supplementalMetadata,
  }

  if (options?.includeStatus || payload.status !== undefined) {
    Object.assign(metadata, buildTaskStatusMetadata(before, after))
  }

  if (payload.incidentReason !== undefined || payload.cancellationReason !== undefined) {
    metadata.incidentReason = after.incidentReason ?? null
    metadata.incidentObservation = after.incidentObservation ?? null
    metadata.incidentReportedBy = after.incidentReportedBy ?? null
    metadata.cancellationReason = after.cancellationReason ?? null
    metadata.cancellationObservation = after.cancellationObservation ?? null
  }

  if (payload.rejectionReason !== undefined) {
    metadata.rejectionReason = after.rejectionReason ?? null
  }

  recordTaskAuditEvent({
    action: AUDIT_ACTIONS.TASK_UPDATE,
    task: before,
    metadata,
    workflowAction: options?.workflowAction,
  })
}

export function recordTaskAssignCrewAudit(
  before: Task,
  after: Task,
  workflowAction: TaskWorkflowAction = "assign-crew"
) {
  recordTaskAuditEvent({
    action: AUDIT_ACTIONS.TASK_ASSIGN_CREW,
    task: before,
    workflowAction,
    metadata: {
      ...buildTaskCrewMetadata(before, after),
      ...buildTaskStatusMetadata(before, after),
    },
  })
}

export function recordTaskRescheduleAudit(
  before: Task,
  after: Task,
  input: TaskRescheduleInput,
  workflowAction: TaskWorkflowAction
) {
  const entityLabel = resolveTaskEntityLabel(before)
  const description =
    workflowAction === "reschedule-obra"
      ? entityLabel
        ? `OT reprogramada: ${entityLabel}.`
        : "OT reprogramada."
      : undefined

  recordTaskAuditEvent({
    action: AUDIT_ACTIONS.TASK_RESCHEDULE,
    task: before,
    workflowAction,
    description,
    metadata: {
      ...buildTaskScheduleMetadata(before, after),
      ...buildTaskCrewMetadata(before, after),
      ...buildTaskStatusMetadata(before, after),
      motivo: input.reason.trim(),
      motivo_label: resolveRescheduleReasonLabel(input.reason),
      observaciones: input.notes?.trim() || null,
      rescheduledBy: input.rescheduledBy.trim(),
      rescheduledAt: after.rescheduledAt ?? new Date().toISOString(),
      previousDate: before.dueDate,
      previousTime: before.scheduledTime ?? null,
      newDate: after.dueDate,
      newTime: after.scheduledTime ?? null,
    },
  })
}

export function recordTaskPlanningReturnAudit(
  before: Task,
  after: Task,
  input: { reason: string; returnedBy: string }
) {
  const entityLabel = resolveTaskEntityLabel(before)

  recordTaskAuditEvent({
    action: AUDIT_ACTIONS.TASK_UPDATE,
    task: before,
    workflowAction: "return-to-atencion",
    description: entityLabel
      ? `OT devuelta por planificación: ${entityLabel}.`
      : "OT devuelta por planificación.",
    metadata: {
      ...buildTaskScheduleMetadata(before, after),
      ...buildTaskCrewMetadata(before, after),
      ...buildTaskStatusMetadata(before, after),
      motivo: input.reason.trim(),
      devueltaPor: input.returnedBy.trim(),
      devueltaAt: after.taskMetadata?.planningReturnAt ?? new Date().toISOString(),
      cuadrillaAnterior: before.crew?.trim() || null,
      fechaAnterior: before.dueDate,
      horaAnterior: before.scheduledTime ?? null,
    },
  })
  recordPlanningReturnActivity({
    taskId: after.id,
    reason: input.reason,
  })
}

export function recordTaskWorkflowStatusAudit(
  action: AuditAction,
  before: Task,
  after: Task,
  workflowAction: TaskWorkflowAction
) {
  recordTaskAuditEvent({
    action,
    task: before,
    workflowAction,
    metadata: buildTaskStatusMetadata(before, after),
  })
}

export function recordTaskDeleteAudit(
  task: Pick<Task, "id" | "code" | "title" | "workOrderNumber" | "status">,
  options?: { administration?: boolean }
) {
  recordTaskAuditEvent({
    action: AUDIT_ACTIONS.TASK_DELETE,
    task,
    metadata: {
      deletedAt: new Date().toISOString(),
      status: task.status,
      softDelete: true,
      ...(options?.administration
        ? { deletedByRole: "administrador", administration: true }
        : {}),
    },
  })
  recordTaskDeleteActivity(task as Task, {
    administration: options?.administration === true,
  })
}

export type TaskMutationAuditContext = {
  before: Task
  after: Task
  payload: UpdateTaskPayload
  workflowAction?: TaskWorkflowAction
  rescheduleInput?: TaskRescheduleInput
}

export function recordTaskMutationAudit(context: TaskMutationAuditContext): void {
  const { before, after, payload, workflowAction, rescheduleInput } = context

  // Activity Engine dual-write (best-effort; never blocks OT mutation).
  recordTaskMutationActivity({
    before,
    after,
    payload,
    workflowAction,
    rescheduleInput,
  })

  if (workflowAction) {
    const auditAction = mapWorkflowActionToAuditAction(workflowAction)

    if (auditAction === AUDIT_ACTIONS.TASK_RESCHEDULE && rescheduleInput) {
      recordTaskRescheduleAudit(before, after, rescheduleInput, workflowAction)
      return
    }

    if (auditAction === AUDIT_ACTIONS.TASK_ASSIGN_CREW) {
      recordTaskAssignCrewAudit(before, after, workflowAction)
      return
    }

    if (auditAction) {
      recordTaskWorkflowStatusAudit(auditAction, before, after, workflowAction)
      return
    }

    recordTaskUpdateAudit(before, payload, after, {
      workflowAction,
      includeStatus: true,
    })
    return
  }

  if (isCrewOnlyPayload(payload)) {
    recordTaskAssignCrewAudit(before, after, "assign-crew")
    return
  }

  const genericKeys = (Object.keys(payload) as (keyof UpdateTaskPayload)[]).filter(
    (key) => !TASK_WORKFLOW_ONLY_FIELDS.has(key)
  )

  const supplementalMetadata: Record<string, unknown> = {}

  if (payload.dueDate !== undefined || payload.scheduledTime !== undefined) {
    Object.assign(supplementalMetadata, buildTaskScheduleMetadata(before, after))
  }

  if (
    payload.crewId !== undefined ||
    payload.crew !== undefined ||
    payload.supervisor !== undefined
  ) {
    Object.assign(supplementalMetadata, buildTaskCrewMetadata(before, after))
  }

  if (payload.status !== undefined) {
    Object.assign(supplementalMetadata, buildTaskStatusMetadata(before, after))
  }

  if (genericKeys.length === 0 && Object.keys(supplementalMetadata).length === 0) {
    return
  }

  const genericPayload = Object.fromEntries(
    genericKeys.map((key) => [key, payload[key]])
  ) as UpdateTaskPayload

  recordTaskUpdateAudit(before, genericPayload, after, {
    supplementalMetadata,
  })
}

export function valuesChangedForAudit(before: unknown, after: unknown): boolean {
  return normalizeAuditValue(before) !== normalizeAuditValue(after)
}
