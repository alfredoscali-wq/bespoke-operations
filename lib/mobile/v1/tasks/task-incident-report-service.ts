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
import { createTaskIncidentService } from "@/lib/task-incidents/task-incident.service"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"

function mapTaskIncidentErrorToMobile(error: TaskIncidentError): MobileApiError {
  const code =
    error.code === "NOT_FOUND"
      ? "INVALID_REQUEST"
      : error.code === "DUPLICATE_ACTIVE"
        ? "INCIDENT_ALREADY_ACTIVE"
        : error.code === "FORBIDDEN"
          ? "UNAUTHORIZED"
          : "INVALID_REQUEST"

  return new MobileApiError(code, error.message, error.httpStatus)
}

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

  if (!incidentTypeCode) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Seleccione un tipo de incidencia.",
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

  const observation = request.observation?.trim() || null
  let createdIncidentId: string | null = null

  try {
    const incident = await createTaskIncidentService(
      {
        companyId: context.auth.companyId,
        actorEmployeeId: context.auth.employeeId,
        client: context.admin,
      },
      {
        taskId: context.task.id,
        employeeId: context.auth.employeeId,
        crewId: context.workTeamId,
        incidentTypeId: incidentType.id,
        comment: observation,
      }
    )
    createdIncidentId = incident.id
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      throw mapTaskIncidentErrorToMobile(error)
    }

    throw error
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
      note: observation
        ? `Motivo: ${incidentType.name}\nObservación: ${observation}`
        : `Motivo: ${incidentType.name}`,
    })
  } catch {
    // Non-blocking audit.
  }

  return {
    id: updatedTask.id,
    status: updatedTask.status,
    incidentId: createdIncidentId ?? "",
  }
}
