import "server-only"

import {
  recordIncidentCreatedAudit,
  resolveMobileReporterName,
} from "@/lib/audit/incidents-audit.server"
import { fetchIncidentTypesForServiceType } from "@/lib/mobile/v1/incidents/incident-type-queries"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import type {
  MobileTaskReportIncidentRequest,
  MobileTaskReportIncidentResponse,
} from "@/lib/mobile/v1/tasks/types"
import { createTaskIncidentService } from "@/lib/task-incidents/task-incident.service"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"
import { resolveOperationalEventActorFromMobile } from "@/lib/tasks/operational-event-actor"
import { buildIncidentOperationalEvent } from "@/lib/tasks/operational-events"
import { recordOperationalEventSafe } from "@/lib/tasks/record-operational-event.server"

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

    const employeeName = await resolveMobileReporterName({
      employeeId: context.auth.employeeId,
      client: context.admin,
    })

    await recordIncidentCreatedAudit({
      auth: context.auth,
      incidentId: incident.id,
      taskId: context.task.id,
      task: context.task,
      incidentTypeId: incidentType.id,
      incidentTypeLabel: incidentType.name,
      incidentTypeCode: incidentType.code,
      comment: observation,
      crewId: context.workTeamId,
      workTeamId: context.workTeamId,
      mobileDeviceId: request.deviceId,
      employeeName,
    })
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      throw mapTaskIncidentErrorToMobile(error)
    }

    throw error
  }

  // RC3.1: task_incidents is the source of truth. The OT remains en-curso so the
  // operator can continue after supervisor resolution without a legacy status hop.

  try {
    await recordOperationalEventSafe(
      buildIncidentOperationalEvent({
        companyId: context.auth.companyId,
        task: context.task,
        actor: resolveOperationalEventActorFromMobile(context.auth),
        reasonLabel: incidentType.name,
        observation: observation ?? "",
        incidentId: createdIncidentId,
        source: "mobile",
      })
    )
  } catch {
    // Non-blocking operational history.
  }

  return {
    id: context.task.id,
    status: context.task.status,
    incidentId: createdIncidentId ?? "",
  }
}
