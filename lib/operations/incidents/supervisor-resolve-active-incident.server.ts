import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { writeAuditLog } from "@/lib/audit/audit-service"
import { recordIncidentResolveSupervisorActionAudit } from "@/lib/audit/incidents-audit.server"
import {
  buildTaskCrewMetadata,
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
  buildSupervisorResolveActiveIncidentPlan,
  buildTaskAfterResolve,
  validateSupervisorResolveActiveIncidentPreconditions,
  validateSupervisorResolveActiveIncidentRequest,
  type SupervisorResolveActiveIncidentPlan,
  type SupervisorResolveActiveIncidentRequest,
} from "@/lib/operations/incidents/supervisor-resolve-active-incident-plan"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { canCloseWorkOrder } from "@/lib/tasks/task-closure-permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fetchTaskById } from "@/lib/supabase/tasks.queries"
import { getTaskIncidentById } from "@/lib/supabase/task-incidents.repository"
import { mapTaskIncidentToResponse } from "@/lib/task-incidents/map-incident-response"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"
import { validateIncidentIdParam } from "@/lib/task-incidents/validate-task-incident-input"
import type { IncidentResponse } from "@/lib/types/task-incidents"
import type { Task } from "@/lib/types/tasks"

export type SupervisorResolveActiveIncidentResult =
  | { ok: true; data: IncidentResponse; task: Task }
  | { ok: false; status: number; message: string; code: string }

function mapValidationCodeToStatus(code: string): number {
  switch (code) {
    case "FORBIDDEN":
      return 403
    case "NOT_FOUND":
      return 404
    case "INVALID_STATUS":
    case "INVALID_INCIDENT":
    case "VALIDATION":
      return 400
    default:
      return 500
  }
}

async function recordResolveTaskAudit(input: {
  sessionUser: SessionUser
  before: Task
  after: Task
  plan: SupervisorResolveActiveIncidentPlan
}): Promise<void> {
  const entityLabel = resolveTaskEntityLabel(input.before)

  if (input.plan.action === "continue") {
    return
  }

  const workflowAction =
    input.plan.action === "reprogram"
      ? "reprogram-from-active-incident"
      : "cancel"

  await writeAuditLog(createAdminClient(), {
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.TASK_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.before.id,
    entityLabel,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.TASK_UPDATE,
      entityLabel,
    }),
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    metadata: {
      ...buildTaskStatusMetadata(input.before, input.after),
      ...(input.plan.action === "reprogram"
        ? buildTaskCrewMetadata(input.before, input.after)
        : {}),
      ...(input.plan.action === "cancel"
        ? {
            cancellationReason: input.after.cancellationReason ?? null,
            cancellationObservation: input.after.cancellationObservation ?? null,
          }
        : {}),
      reason: input.plan.comment,
      workflowAction,
    },
  })
}

export async function supervisorResolveActiveIncident(
  sessionUser: SessionUser,
  incidentId: string,
  body: unknown
): Promise<SupervisorResolveActiveIncidentResult> {
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

    const request = validateSupervisorResolveActiveIncidentRequest(body)
    if ("ok" in request && request.ok === false) {
      return {
        ok: false,
        status: mapValidationCodeToStatus(request.code),
        message: request.message,
        code: request.code,
      }
    }

    const resolvedRequest = request as SupervisorResolveActiveIncidentRequest
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

    const preconditionValidation =
      validateSupervisorResolveActiveIncidentPreconditions({
        canSupervise: canCloseWorkOrder(sessionUser.systemRole),
        task: taskResult.data,
        incident: {
          id: incident.id,
          companyId: incident.companyId,
          taskId: incident.taskId,
          status: incident.status,
        },
        companyId,
      })

    if (!preconditionValidation.ok) {
      return {
        ok: false,
        status: mapValidationCodeToStatus(preconditionValidation.code),
        message: preconditionValidation.message,
        code: preconditionValidation.code,
      }
    }

    const plan = buildSupervisorResolveActiveIncidentPlan({
      task: taskResult.data,
      request: resolvedRequest,
    })

    const admin = createAdminClient()
    const { data: rpcData, error: rpcError } = await (
      admin as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>
      }
    ).rpc("supervisor_resolve_active_task_incident", {
      p_company_id: companyId,
      p_incident_id: incident.id,
      p_actor_employee_id: sessionUser.employeeId,
      p_action: plan.action,
      p_comment: plan.comment,
      p_task_metadata: plan.taskMetadata,
      p_pre_dispatch_clears: plan.preDispatchClears,
      p_cancellation_reason: plan.cancellationReason,
      p_cancellation_observation: plan.cancellationObservation,
    })

    if (rpcError) {
      logOperationError("Supervisor resolve RC3.2.1", rpcError)
      return {
        ok: false,
        status: 400,
        message:
          rpcError.message ||
          "No fue posible resolver la incidencia de la orden de trabajo.",
        code: "RPC_FAILED",
      }
    }

    if (!rpcData) {
      return {
        ok: false,
        status: 500,
        message: "No fue posible resolver la incidencia.",
        code: "RPC_EMPTY",
      }
    }

    const afterTask = buildTaskAfterResolve({
      before: taskResult.data,
      plan,
    })

    try {
      await recordResolveTaskAudit({
        sessionUser,
        before: taskResult.data,
        after: afterTask,
        plan,
      })
    } catch (auditError) {
      logOperationError("Supervisor resolve RC3.2.1 task audit", auditError)
    }

    try {
      await recordIncidentResolveSupervisorActionAudit({
        sessionUser,
        companyId,
        incidentId: incident.id,
        client: readClient,
        action: plan.action,
        previousIncidentStatus: incident.status,
        message:
          plan.action === "continue" ? plan.comment : null,
        reason:
          plan.action === "continue" ? null : plan.comment,
        previousTaskStatus:
          plan.action === "continue" ? null : taskResult.data.status,
        nextTaskStatus:
          plan.action === "continue" ? null : afterTask.status,
      })
    } catch (auditError) {
      logOperationError("Supervisor resolve RC3.2.1 incident audit", auditError)
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
        message:
          "La resolución se aplicó pero no fue posible recargar la incidencia.",
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

    logOperationError("Supervisor resolve RC3.2.1", error)
    return {
      ok: false,
      status: 500,
      message: "No fue posible resolver la incidencia.",
      code: "UNKNOWN",
    }
  }
}
