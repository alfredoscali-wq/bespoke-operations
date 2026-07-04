import "server-only"

import { recordTaskMobileWorkflowAudit } from "@/lib/audit/tasks-audit.server"
import { fetchIncidentTypesForServiceType } from "@/lib/mobile/v1/incidents/incident-type-queries"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import type {
  MobileTaskReportIncidentRequest,
  MobileTaskReportIncidentResponse,
} from "@/lib/mobile/v1/tasks/types"
import { getTransitionForAction } from "@/lib/tasks/task-status-workflow"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"

export async function reportMobileTaskIncident(
  auth: Parameters<typeof assertMobileTaskExecutionAccess>[0],
  taskId: string,
  request: MobileTaskReportIncidentRequest
): Promise<MobileTaskReportIncidentResponse> {
  const context = await assertMobileTaskExecutionAccess(
    auth,
    taskId,
    request.deviceId,
    { allowedStatuses: ["en-curso"] }
  )

  const incidentTypeCode = request.incidentTypeCode.trim()
  const observation = request.observation.trim()

  if (!incidentTypeCode) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Seleccione un tipo de incidencia.",
      400
    )
  }

  if (!observation) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Describa brevemente la situación.",
      400
    )
  }

  const incidentTypes = await fetchIncidentTypesForServiceType(
    context.admin,
    context.auth.companyId,
    context.task.serviceType
  )

  const incidentType = incidentTypes.find((item) => item.code === incidentTypeCode)

  if (!incidentType) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Tipo de incidencia no válido.",
      400
    )
  }

  const { to } = getTransitionForAction("report-incident")
  const reportedAt = new Date().toISOString()
  const existingMetadata =
    context.task.taskMetadata && typeof context.task.taskMetadata === "object"
      ? context.task.taskMetadata
      : {}

  const { data, error } = await context.admin
    .from("tasks")
    .update({
      status: to,
      incident_reason: incidentType.code,
      incident_observation: observation,
      incident_reported_at: reportedAt,
      incident_reported_by: context.auth.displayName,
      task_metadata: {
        ...existingMetadata,
        ...(request.photoIds && request.photoIds.length > 0
          ? { incidentPhotoIds: request.photoIds }
          : {}),
      },
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
    await recordTaskMobileWorkflowAudit({
      auth: context.auth,
      before: context.task,
      after: updatedTask,
      workflowAction: "report-incident",
      workTeamId: context.workTeamId,
      workTeamName: context.workTeamName,
      mobileDeviceId: context.mobileDeviceId,
      note: `Motivo: ${incidentType.name}\nObservación: ${observation}`,
    })
  } catch {
    // Non-blocking audit.
  }

  return {
    id: updatedTask.id,
    status: updatedTask.status,
  }
}
