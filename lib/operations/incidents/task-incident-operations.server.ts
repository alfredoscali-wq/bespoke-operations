import "server-only"

import type { SessionUser } from "@/lib/auth/types"
import {
  shouldRecordIncidentClosedAudit,
  shouldRecordIncidentSupervisorAudit,
} from "@/lib/audit/incidents-audit.shared"
import {
  recordIncidentClosedAudit,
  recordIncidentSupervisorActionFromEventType,
} from "@/lib/audit/incidents-audit.server"
import { logOperationError } from "@/lib/operations/user-messages"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { createClient } from "@/lib/supabase/server"
import {
  addTaskIncidentEventService,
  addTaskIncidentPhotoService,
  getTaskIncidentByIdService,
  listTaskIncidentsService,
  updateTaskIncidentStatusService,
} from "@/lib/task-incidents/task-incident.service"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"
import {
  parseOptionalBooleanQuery,
  parseOptionalTaskIncidentStatus,
  validateAddIncidentEventRequest,
  validateAddIncidentPhotoRequest,
  validateIncidentIdParam,
  validateUpdateIncidentStatusRequest,
} from "@/lib/task-incidents/validate-task-incident-input"
import type {
  AddIncidentEventRequest,
  AddIncidentPhotoRequest,
  IncidentResponse,
  IncidentSummary,
  UpdateIncidentStatusRequest,
} from "@/lib/types/task-incidents"
import type { ListTaskIncidentsFilters } from "@/lib/types/supabase/task-incidents"

export type OperationsIncidentResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; code: string }

function mapTaskIncidentError(
  error: TaskIncidentError
): OperationsIncidentResult<never> {
  return {
    ok: false,
    status: error.httpStatus,
    message: error.message,
    code: error.code,
  }
}

function resolveActorEmployeeId(sessionUser: SessionUser): string {
  if (!sessionUser.employeeId) {
    throw new TaskIncidentError(
      "FORBIDDEN",
      "Su perfil no tiene un empleado asociado.",
      403
    )
  }

  return sessionUser.employeeId
}

async function createOperationsReadContext(sessionUser: SessionUser) {
  return {
    companyId: resolveTenantCompanyId(sessionUser),
    actorEmployeeId: sessionUser.employeeId ?? "",
    client: await createClient(),
  }
}

async function createOperationsWriteContext(sessionUser: SessionUser) {
  return {
    companyId: resolveTenantCompanyId(sessionUser),
    actorEmployeeId: resolveActorEmployeeId(sessionUser),
    client: await createClient(),
  }
}

export function parseOperationsIncidentListFilters(
  searchParams: URLSearchParams
): ListTaskIncidentsFilters {
  const taskId = searchParams.get("taskId")?.trim() || undefined
  const activeOnly = parseOptionalBooleanQuery(searchParams.get("activeOnly"))
  const status = parseOptionalTaskIncidentStatus(searchParams.get("status"))

  if (taskId) {
    validateIncidentIdParam(taskId)
  }

  return {
    taskId,
    activeOnly,
    status,
  }
}

export async function listOperationsIncidents(
  sessionUser: SessionUser,
  filters?: ListTaskIncidentsFilters
): Promise<OperationsIncidentResult<IncidentSummary[]>> {
  try {
    const context = await createOperationsReadContext(sessionUser)
    const data = await listTaskIncidentsService(context, filters)
    return { ok: true, data }
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      return mapTaskIncidentError(error)
    }

    logOperationError("Operations incidents", error)
    return {
      ok: false,
      status: 500,
      message: "No fue posible cargar las incidencias.",
      code: "UNKNOWN",
    }
  }
}

export async function getOperationsIncidentById(
  sessionUser: SessionUser,
  incidentId: string
): Promise<OperationsIncidentResult<IncidentResponse>> {
  try {
    const context = await createOperationsReadContext(sessionUser)
    const data = await getTaskIncidentByIdService(context, incidentId)
    return { ok: true, data }
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      return mapTaskIncidentError(error)
    }

    logOperationError("Operations incidents", error)
    return {
      ok: false,
      status: 500,
      message: "No fue posible cargar la incidencia.",
      code: "UNKNOWN",
    }
  }
}

export async function updateOperationsIncidentStatus(
  sessionUser: SessionUser,
  incidentId: string,
  request: UpdateIncidentStatusRequest
): Promise<OperationsIncidentResult<IncidentResponse>> {
  try {
    const context = await createOperationsWriteContext(sessionUser)
    const validated = validateUpdateIncidentStatusRequest(request)
    const before = await getTaskIncidentByIdService(context, incidentId)
    const data = await updateTaskIncidentStatusService(
      context,
      incidentId,
      validated
    )

    if (
      shouldRecordIncidentClosedAudit({
        auditExplicitClosure: validated.auditExplicitClosure,
        status: validated.status,
      })
    ) {
      await recordIncidentClosedAudit({
        sessionUser,
        companyId: context.companyId,
        incidentId,
        client: context.client,
        previousIncidentStatus: before.status,
        closureResult: validated.status,
        note: validated.comment,
      })
    }

    return { ok: true, data }
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      return mapTaskIncidentError(error)
    }

    logOperationError("Operations incidents", error)
    return {
      ok: false,
      status: 500,
      message: "No fue posible actualizar la incidencia.",
      code: "UNKNOWN",
    }
  }
}

export async function addOperationsIncidentEvent(
  sessionUser: SessionUser,
  incidentId: string,
  request: AddIncidentEventRequest
): Promise<OperationsIncidentResult<IncidentResponse>> {
  try {
    const context = await createOperationsWriteContext(sessionUser)
    const validated = validateAddIncidentEventRequest(request)
    const before = await getTaskIncidentByIdService(context, incidentId)
    const data = await addTaskIncidentEventService(
      context,
      incidentId,
      validated
    )

    if (shouldRecordIncidentSupervisorAudit(validated.eventType)) {
      await recordIncidentSupervisorActionFromEventType({
        sessionUser,
        companyId: context.companyId,
        incidentId,
        client: context.client,
        eventType: validated.eventType,
        previousIncidentStatus: before.status,
        note: validated.comment,
      })
    }

    return { ok: true, data }
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      return mapTaskIncidentError(error)
    }

    logOperationError("Operations incidents", error)
    return {
      ok: false,
      status: 500,
      message: "No fue posible registrar el evento.",
      code: "UNKNOWN",
    }
  }
}

export async function addOperationsIncidentPhoto(
  sessionUser: SessionUser,
  incidentId: string,
  request: AddIncidentPhotoRequest
): Promise<OperationsIncidentResult<IncidentResponse>> {
  try {
    const context = await createOperationsWriteContext(sessionUser)
    const validated = validateAddIncidentPhotoRequest(request)
    const data = await addTaskIncidentPhotoService(
      context,
      incidentId,
      validated
    )
    return { ok: true, data }
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      return mapTaskIncidentError(error)
    }

    logOperationError("Operations incidents", error)
    return {
      ok: false,
      status: 500,
      message: "No fue posible registrar la fotografía.",
      code: "UNKNOWN",
    }
  }
}
