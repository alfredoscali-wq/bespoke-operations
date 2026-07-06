import "server-only"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileCreateIncidentRequest } from "@/lib/mobile/v1/incidents/validate-incident-request"
import type { MobileIncidentCreatedResponse } from "@/lib/mobile/v1/incidents/types"
import { mapIncidentResponseToMobileCreated } from "@/lib/mobile/v1/incidents/types"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  createTaskIncidentService,
  getTaskIncidentByIdService,
} from "@/lib/task-incidents/task-incident.service"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"
import type { IncidentResponse } from "@/lib/types/task-incidents"

function mapTaskIncidentErrorToMobile(error: TaskIncidentError): MobileApiError {
  const code =
    error.code === "NOT_FOUND"
      ? "INCIDENT_NOT_FOUND"
      : error.code === "DUPLICATE_ACTIVE"
        ? "INCIDENT_ALREADY_ACTIVE"
        : error.code === "INVALID_STATUS"
          ? "INVALID_INCIDENT_STATUS"
          : error.code === "FORBIDDEN"
            ? "UNAUTHORIZED"
            : "INVALID_REQUEST"

  return new MobileApiError(code, error.message, error.httpStatus)
}

export async function createMobileIncident(
  auth: MobileAuthContext,
  request: MobileCreateIncidentRequest
): Promise<MobileIncidentCreatedResponse> {
  const context = await assertMobileTaskExecutionAccess(
    auth,
    request.taskId,
    request.deviceId,
    { allowedStatuses: ["en-curso"] }
  )

  if (request.employeeId !== auth.employeeId) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Solo puede reportar incidencias con su propio empleado.",
      400
    )
  }

  try {
    const incident = await createTaskIncidentService(
      {
        companyId: auth.companyId,
        actorEmployeeId: auth.employeeId,
        client: context.admin,
      },
      {
        taskId: request.taskId,
        employeeId: auth.employeeId,
        crewId: context.workTeamId,
        incidentTypeId: request.incidentTypeId,
        comment: request.comment,
        canContinue: request.canContinue,
        requiresSupervisorAction: request.requiresSupervisorAction,
      }
    )

    return mapIncidentResponseToMobileCreated(incident)
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      throw mapTaskIncidentErrorToMobile(error)
    }

    throw error
  }
}

export async function getMobileIncidentById(
  auth: MobileAuthContext,
  incidentId: string,
  deviceId: string
): Promise<IncidentResponse> {
  const admin = createAdminClient()

  try {
    const incident = await getTaskIncidentByIdService(
      {
        companyId: auth.companyId,
        actorEmployeeId: auth.employeeId,
        client: admin,
      },
      incidentId
    )

    if (incident.companyId !== auth.companyId) {
      throw new MobileApiError(
        "INCIDENT_NOT_FOUND",
        "Incidencia no encontrada.",
        404
      )
    }

    if (incident.employeeId !== auth.employeeId) {
      await assertMobileTaskExecutionAccess(auth, incident.taskId, deviceId, {
        requireActiveShift: false,
      })
    }

    return incident
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      throw mapTaskIncidentErrorToMobile(error)
    }

    throw error
  }
}
