import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { writeAuditLog } from "@/lib/audit/audit-service"
import { INCIDENT_SUPERVISOR_ACTIONS } from "@/lib/audit/incidents-audit.shared"
import { recordIncidentSupervisorActionAudit } from "@/lib/audit/incidents-audit.server"
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
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import { logOperationError } from "@/lib/operations/user-messages"
import {
  buildSupervisorRescheduleActiveTaskPlan,
  validateSupervisorRescheduleActiveTaskPreconditions,
  type SupervisorRescheduleActiveTaskPlan,
} from "@/lib/operations/incidents/supervisor-reschedule-active-task-plan"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { resolveRescheduleReasonLabel } from "@/lib/tasks/reschedule"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import { canUsePlanningWebOperationalActions } from "@/lib/roles/web-module-access"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { resolveOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import { buildRescheduleOperationalEvent } from "@/lib/tasks/operational-motivos"
import { buildIncidentResolvedOperationalEvent } from "@/lib/tasks/operational-events"
import { recordOperationalEventSafe } from "@/lib/tasks/record-operational-event.server"
import { fetchCrews } from "@/lib/supabase/crews.queries"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fetchTaskById, fetchTasks } from "@/lib/supabase/tasks.queries"
import { getTaskIncidentById } from "@/lib/supabase/task-incidents.repository"
import { mapTaskIncidentToResponse } from "@/lib/task-incidents/map-incident-response"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"
import { validateIncidentIdParam } from "@/lib/task-incidents/validate-task-incident-input"
import type { IncidentResponse } from "@/lib/types/task-incidents"
import type { Task } from "@/lib/types/tasks"

export type SupervisorRescheduleActiveTaskRequest = TaskRescheduleInput & {
  crewId?: string | null
  crew?: string
  supervisor?: string
}

export type SupervisorRescheduleActiveTaskResult =
  | { ok: true; data: IncidentResponse; task: Task }
  | { ok: false; status: number; message: string; code: string }

function mapValidationCodeToStatus(
  code: string
): number {
  switch (code) {
    case "FORBIDDEN":
      return 403
    case "NOT_FOUND":
      return 404
    case "INVALID_STATUS":
    case "INVALID_INCIDENT":
    case "INVALID_CREW":
    case "VALIDATION":
      return 400
    default:
      return 500
  }
}

function buildTaskAfterReschedule(
  before: Task,
  plan: SupervisorRescheduleActiveTaskPlan
): Task {
  const postAssignment = plan.postDispatchAssignments.find(
    (update) => update.task_id === before.id
  )

  return {
    ...before,
    status: plan.targetStatus,
    dueDate: plan.taskPayload.dueDate ?? before.dueDate,
    startDate: plan.taskPayload.startDate ?? before.startDate,
    scheduledTime: plan.taskPayload.scheduledTime ?? before.scheduledTime,
    crewId:
      plan.taskPayload.crewId !== undefined
        ? plan.taskPayload.crewId ?? undefined
        : before.crewId,
    crew: plan.taskPayload.crew ?? before.crew,
    supervisor: plan.taskPayload.supervisor ?? before.supervisor,
    executionOrder: null,
    dispatchOrder: postAssignment?.dispatch_order ?? null,
    rescheduledBy: plan.taskPayload.rescheduledBy ?? before.rescheduledBy,
    rescheduledAt: plan.taskPayload.rescheduledAt ?? before.rescheduledAt,
    rescheduleReason: plan.taskPayload.rescheduleReason ?? before.rescheduleReason,
    rescheduleNotes: plan.taskPayload.rescheduleNotes ?? before.rescheduleNotes,
    originalScheduledDate:
      plan.taskPayload.originalScheduledDate ?? before.originalScheduledDate,
    originalScheduledTime:
      plan.taskPayload.originalScheduledTime ?? before.originalScheduledTime,
    taskMetadata: plan.taskMetadata,
  }
}

async function recordSupervisorRescheduleAudit(input: {
  sessionUser: SessionUser
  before: Task
  after: Task
  rescheduleInput: TaskRescheduleInput
}): Promise<void> {
  const entityLabel = resolveTaskEntityLabel(input.before)

  await writeAuditLog(createAdminClient(), {
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.TASK_RESCHEDULE,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.before.id,
    entityLabel,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.TASK_RESCHEDULE,
      entityLabel,
    }),
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    metadata: {
      ...buildTaskScheduleMetadata(input.before, input.after),
      ...buildTaskCrewMetadata(input.before, input.after),
      ...buildTaskStatusMetadata(input.before, input.after),
      motivo: input.rescheduleInput.reason.trim(),
      motivo_label: resolveRescheduleReasonLabel(input.rescheduleInput.reason),
      observaciones: input.rescheduleInput.notes?.trim() || null,
      rescheduledBy: input.rescheduleInput.rescheduledBy.trim(),
      rescheduledAt: input.after.rescheduledAt ?? new Date().toISOString(),
      workflowAction: "reschedule-from-active-incident",
    },
  })
}

export async function supervisorRescheduleActiveTaskFromIncident(
  sessionUser: SessionUser,
  incidentId: string,
  request: SupervisorRescheduleActiveTaskRequest
): Promise<SupervisorRescheduleActiveTaskResult> {
  try {
    const validatedIncidentId = validateIncidentIdParam(incidentId)
    const companyId = resolveTenantCompanyId(sessionUser)

    if (!sessionUser.employeeId) {
      return {
        ok: false,
        status: 403,
        message: "Su perfil no tiene un empleado asociado.",
        code: "FORBIDDEN",
      }
    }

    const readClient = await createClient()
    const incidentResult = await getTaskIncidentById(
      validatedIncidentId,
      companyId,
      readClient
    )

    if (incidentResult.error || !incidentResult.data) {
      return {
        ok: false,
        status: 404,
        message: "Incidencia no encontrada.",
        code: "NOT_FOUND",
      }
    }

    const incident = incidentResult.data
    const taskResult = await fetchTaskById(readClient, incident.taskId)

    if (taskResult.error || !taskResult.data) {
      return {
        ok: false,
        status: 404,
        message: "Orden de trabajo no encontrada.",
        code: "NOT_FOUND",
      }
    }

    const crewsResult = await fetchCrews(readClient, companyId)
    const crews = crewsResult.data ?? []

    const crewId = request.crewId ?? taskResult.data.crewId ?? null
    const selectedCrew = crewId
      ? crews.find((crew) => crew.id === crewId) ?? null
      : null

    const preconditionValidation = validateSupervisorRescheduleActiveTaskPreconditions({
      canSupervise: canUsePlanningWebOperationalActions(sessionUser),
      task: taskResult.data,
      incident: {
        id: incident.id,
        companyId: incident.companyId,
        taskId: incident.taskId,
        status: incident.status,
      },
      companyId,
      crew: selectedCrew,
    })

    if (!preconditionValidation.ok) {
      return {
        ok: false,
        status: mapValidationCodeToStatus(preconditionValidation.code),
        message: preconditionValidation.message,
        code: preconditionValidation.code,
      }
    }

    const plan = buildSupervisorRescheduleActiveTaskPlan({
      task: taskResult.data,
      allTasks: (await fetchTasks(readClient, companyId)).data ?? [],
      rescheduleInput: {
        ...request,
        crewId: selectedCrew!.id,
        crew: request.crew ?? selectedCrew!.name,
        supervisor:
          request.supervisor ??
          selectedCrew!.supervisor ??
          taskResult.data.supervisor,
        rescheduledBy:
          request.rescheduledBy.trim() || sessionUser.displayName.trim(),
      },
      crews,
    })

    if ("ok" in plan && plan.ok === false) {
      return {
        ok: false,
        status: mapValidationCodeToStatus(plan.code),
        message: plan.message,
        code: plan.code,
      }
    }

    const successfulPlan = plan as SupervisorRescheduleActiveTaskPlan
    const admin = createAdminClient()
    const payload = successfulPlan.taskPayload

    const { data: rpcData, error: rpcError } = await (
      admin as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>
      }
    ).rpc("supervisor_reschedule_active_task_from_incident", {
        p_company_id: companyId,
        p_incident_id: incident.id,
        p_task_id: taskResult.data.id,
        p_actor_employee_id: sessionUser.employeeId,
        p_due_date: payload.dueDate,
        p_scheduled_time: payload.scheduledTime,
        p_crew_id: payload.crewId,
        p_crew: payload.crew ?? "",
        p_supervisor: payload.supervisor ?? "",
        p_rescheduled_by: payload.rescheduledBy ?? "",
        p_reschedule_reason: payload.rescheduleReason ?? "",
        p_reschedule_notes: payload.rescheduleNotes ?? "",
        p_task_metadata: successfulPlan.taskMetadata,
        p_original_scheduled_date: payload.originalScheduledDate ?? null,
        p_original_scheduled_time: payload.originalScheduledTime ?? null,
        p_pre_dispatch_clears: successfulPlan.preDispatchClears,
        p_post_dispatch_assignments: successfulPlan.postDispatchAssignments,
        p_incident_event_comment: successfulPlan.incidentEventComment,
    })

    if (rpcError) {
      logOperationError("Supervisor reschedule RC3.1", rpcError)
      return {
        ok: false,
        status: 400,
        message:
          rpcError.message ||
          "No fue posible replanificar la orden de trabajo desde la incidencia.",
        code: "RPC_FAILED",
      }
    }

    if (!rpcData) {
      return {
        ok: false,
        status: 500,
        message: "No fue posible replanificar la orden de trabajo.",
        code: "RPC_EMPTY",
      }
    }

    const afterTask = buildTaskAfterReschedule(taskResult.data, successfulPlan)

    try {
      await recordSupervisorRescheduleAudit({
        sessionUser,
        before: taskResult.data,
        after: afterTask,
        rescheduleInput: successfulPlan.rescheduleInput,
      })
    } catch (auditError) {
      logOperationError("Supervisor reschedule RC3.1 audit", auditError)
    }

    const { recordActivityEventSafe } = await import(
      "@/lib/activity/activity-service"
    )
    const {
      ACTIVITY_ACTIONS,
      ACTIVITY_ACTOR_TYPES,
      ACTIVITY_ENTITY_TYPES,
      ACTIVITY_MODULES,
      ACTIVITY_ORIGINS,
    } = await import("@/lib/activity/types")
    const { buildTaskRescheduleMetadata } = await import(
      "@/lib/activity/adapters/tasks-activity"
    )
    void recordActivityEventSafe({
      companyId,
      employeeId: sessionUser.employeeId,
      actorType: ACTIVITY_ACTOR_TYPES.EMPLOYEE,
      module: ACTIVITY_MODULES.TASKS,
      entityType: ACTIVITY_ENTITY_TYPES.TASK,
      entityId: afterTask.id,
      action: ACTIVITY_ACTIONS.TASK_RESCHEDULE,
      detail: "OT reprogramada desde incidencia (supervisor).",
      metadata: {
        ...buildTaskRescheduleMetadata(taskResult.data, afterTask),
        reason: successfulPlan.rescheduleInput.reason.trim(),
        workflowAction: "reschedule-from-active-incident",
      },
      origin: ACTIVITY_ORIGINS.API,
    })

    await recordIncidentSupervisorActionAudit({
      sessionUser,
      companyId,
      incidentId: incident.id,
      client: readClient,
      supervisorAction: INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE,
      previousIncidentStatus: incident.status,
      note: successfulPlan.incidentEventComment,
      previousDueDate: taskResult.data.dueDate ?? null,
      newDueDate: afterTask.dueDate ?? null,
      previousCrewId: taskResult.data.crewId ?? null,
      newCrewId: afterTask.crewId ?? null,
      previousCrewName: taskResult.data.crew ?? null,
      newCrewName: afterTask.crew ?? null,
    })

    try {
      const actor = resolveOperationalEventActor(sessionUser)
      await recordOperationalEventSafe(
        buildIncidentResolvedOperationalEvent({
          companyId,
          task: taskResult.data,
          actor,
          action: "reprogram",
          comment: successfulPlan.incidentEventComment,
          incidentId: incident.id,
        })
      )
      await recordOperationalEventSafe(
        buildRescheduleOperationalEvent({
          companyId,
          task: taskResult.data,
          reschedule: successfulPlan.rescheduleInput,
          actor,
          motivoLabel: resolveRescheduleReasonLabel(
            successfulPlan.rescheduleInput.reason
          ),
        })
      )
    } catch (historyError) {
      logOperationError(
        "Supervisor reschedule RC3.1 operational history",
        historyError
      )
    }

    const refreshedIncident = await getTaskIncidentById(
      validatedIncidentId,
      companyId,
      readClient
    )

    if (refreshedIncident.error || !refreshedIncident.data) {
      return {
        ok: false,
        status: 500,
        message: "La replanificación se aplicó pero no fue posible recargar la incidencia.",
        code: "REFRESH_FAILED",
      }
    }

    return {
      ok: true,
      data: mapTaskIncidentToResponse(refreshedIncident.data),
      task: afterTask,
    }
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      return {
        ok: false,
        status: error.httpStatus,
        message: error.message,
        code: error.code,
      }
    }

    logOperationError("Supervisor reschedule RC3.1", error)
    return {
      ok: false,
      status: 500,
      message: "No fue posible replanificar la orden de trabajo.",
      code: "UNKNOWN",
    }
  }
}

export function describeSupervisorRescheduleRequestScope(input: {
  task: Pick<Task, "dueDate" | "crewId" | "crew">
  request: Pick<SupervisorRescheduleActiveTaskRequest, "dueDate" | "crewId">
  crews: Parameters<typeof resolveTaskCrewId>[1]
}): {
  originCrewId: string | null
  destinationCrewId: string | null
} {
  return {
    originCrewId: resolveTaskCrewId(input.task, input.crews ?? []) ?? null,
    destinationCrewId: input.request.crewId ?? null,
  }
}
