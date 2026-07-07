import "server-only"

import { recordTaskMobileWorkflowAudit } from "@/lib/audit/tasks-audit.server"
import {
  fetchOperationalChecklistTemplate,
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

  const template = await fetchOperationalChecklistTemplate(
    context.admin,
    context.auth.companyId,
    context.task.serviceType
  )

  const responses = readOperationalChecklistResponses(context.task)
  const validation = validateOperationalChecklistComplete(template, responses)

  if (!validation.allowed) {
    throw new MobileApiError(
      "TASK_CHECKLIST_INCOMPLETE",
      validation.message ?? "Debe completar el checklist antes de finalizar.",
      409
    )
  }

  const { to } = getTransitionForAction("submit-for-approval")

  const { data, error } = await context.admin
    .from("tasks")
    .update({ status: to })
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

  return {
    id: updatedTask.id,
    status: updatedTask.status,
  }
}
