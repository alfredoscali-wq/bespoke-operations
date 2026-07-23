import "server-only"

import { recordTaskMobileWorkflowAudit } from "@/lib/audit/tasks-audit.server"
import {
  fetchOperationalChecklistTemplateForTask,
  readOperationalChecklistResponses,
  validateOperationalChecklistComplete,
} from "@/lib/mobile/v1/tasks/checklist-execution"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import { assertMobileTaskExecutionNotBlockedByActiveIncident } from "@/lib/mobile/v1/tasks/task-active-incident-guard"
import type {
  MobileTaskSubmitForApprovalRequest,
  MobileTaskSubmitForApprovalResponse,
} from "@/lib/mobile/v1/tasks/types"
import { getTransitionForAction } from "@/lib/tasks/task-status-workflow"
import {
  mergeTrabajoRealizadoIntoMetadata,
  validateTrabajoRealizado,
} from "@/lib/tasks/trabajo-realizado"
import { resolveOperationalEventActorFromMobile } from "@/lib/tasks/operational-event-actor"
import {
  buildChecklistCompletedOperationalEvent,
  buildPendingClosureOperationalEvent,
  buildTrabajoRealizadoOperationalEvent,
} from "@/lib/tasks/operational-events"
import {
  recordOperationalEventOnce,
  recordOperationalEventSafe,
} from "@/lib/tasks/record-operational-event.server"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"

export async function submitMobileTaskForApproval(
  auth: Parameters<typeof assertMobileTaskExecutionAccess>[0],
  taskId: string,
  request: MobileTaskSubmitForApprovalRequest
): Promise<MobileTaskSubmitForApprovalResponse> {
  const context = await assertMobileTaskExecutionAccess(
    auth,
    taskId,
    request.deviceId,
    { allowedStatuses: ["en-curso"] }
  )

  await assertMobileTaskExecutionNotBlockedByActiveIncident(context)

  const trabajoValidation = validateTrabajoRealizado(request.trabajoRealizado)
  if (!trabajoValidation.ok) {
    // Diagnostic only — business rule returns 409 (not 400).
    console.warn("[Mobile API][submit-for-approval]", {
      taskId,
      validation: "TASK_TRABAJO_REALIZADO_REQUIRED",
      httpStatus: 409,
      message: trabajoValidation.message,
    })
    throw new MobileApiError(
      "TASK_TRABAJO_REALIZADO_REQUIRED",
      trabajoValidation.message,
      409
    )
  }

  const template = await fetchOperationalChecklistTemplateForTask(
    context.admin,
    context.auth.companyId,
    context.task
  )

  const responses = readOperationalChecklistResponses(context.task)
  const validation = validateOperationalChecklistComplete(template, responses)

  if (!validation.allowed) {
    // Diagnostic only — business rule returns 409 (not 400).
    console.warn("[Mobile API][submit-for-approval]", {
      taskId,
      validation: "TASK_CHECKLIST_INCOMPLETE",
      httpStatus: 409,
      message:
        validation.message ?? "Debe completar el checklist antes de finalizar.",
    })
    throw new MobileApiError(
      "TASK_CHECKLIST_INCOMPLETE",
      validation.message ?? "Debe completar el checklist antes de finalizar.",
      409
    )
  }

  const { to } = getTransitionForAction("submit-for-approval")
  const nextMetadata = mergeTrabajoRealizadoIntoMetadata(
    context.task.taskMetadata,
    trabajoValidation.value
  )

  const { data, error } = await context.admin
    .from("tasks")
    .update({
      status: to,
      task_metadata: nextMetadata,
    })
    .eq("id", context.task.id)
    .eq("company_id", context.auth.companyId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    throw error ?? new Error("TASK_UPDATE_FAILED")
  }

  const updatedTask = mapTaskRowToTask(data)

  try {
    const actor = resolveOperationalEventActorFromMobile(context.auth)

    await recordOperationalEventOnce({
      event: buildChecklistCompletedOperationalEvent({
        companyId: context.auth.companyId,
        task: context.task,
        actor,
        source: "mobile",
      }),
    })

    await recordOperationalEventSafe(
      buildTrabajoRealizadoOperationalEvent({
        companyId: context.auth.companyId,
        task: context.task,
        actor,
        trabajoRealizado: trabajoValidation.value,
        source: "mobile",
      })
    )

    await recordOperationalEventSafe(
      buildPendingClosureOperationalEvent({
        companyId: context.auth.companyId,
        task: context.task,
        actor,
        source: "mobile",
      })
    )
  } catch {
    // Non-blocking operational history.
  }

  try {
    await recordTaskMobileWorkflowAudit({
      auth: context.auth,
      before: context.task,
      after: updatedTask,
      workflowAction: "submit-for-approval",
      workTeamId: context.workTeamId,
      workTeamName: context.workTeamName,
      mobileDeviceId: context.mobileDeviceId,
      note: "Cierre solicitado por operario desde Field Agent.",
    })
  } catch {
    // Non-blocking audit.
  }

  try {
    const { recordTaskMobileSubmitActivity } = await import(
      "@/lib/activity/adapters/tasks-activity.server"
    )
    await recordTaskMobileSubmitActivity({
      auth: context.auth,
      before: context.task,
      after: updatedTask,
      workTeamId: context.workTeamId,
      workTeamName: context.workTeamName,
      mobileDeviceId: context.mobileDeviceId,
    })
  } catch {
    // Non-blocking OIE.
  }

  return {
    id: updatedTask.id,
    status: updatedTask.status,
  }
}
