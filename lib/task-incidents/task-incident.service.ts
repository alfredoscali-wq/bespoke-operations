import "server-only"

import { fetchIncidentTypeById } from "@/lib/supabase/incident-types.queries"
import { getEmployeeById } from "@/lib/supabase/employees.repository"
import type { SupabaseTaskIncidentsClient } from "@/lib/supabase/task-incidents.repository"
import {
  addTaskIncidentEventRecord,
  addTaskIncidentPhotoRecord,
  createTaskIncidentRecord,
  findActiveTaskIncidentByTaskId,
  getTaskIncidentById,
  listActiveTaskIncidents,
  listTaskIncidents,
  listTaskIncidentsByTaskId,
  updateTaskIncidentRecord,
} from "@/lib/supabase/task-incidents.repository"
import {
  mapRepositoryErrorToTaskIncidentError,
  TaskIncidentError,
} from "@/lib/task-incidents/task-incident-errors"
import {
  mapTaskIncidentToResponse,
  mapTaskIncidentsToSummaries,
} from "@/lib/task-incidents/map-incident-response"
import {
  assertValidStatusTransition,
  isTerminalTaskIncidentStatus,
} from "@/lib/task-incidents/task-incident-status-transitions"
import {
  TASK_INCIDENT_EVENT_CREATED,
  TASK_INCIDENT_EVENT_STATUS_CHANGED,
  validateAddIncidentEventRequest,
  validateAddIncidentPhotoRequest,
  validateCreateIncidentRequest,
  validateIncidentIdParam,
  validateUpdateIncidentStatusRequest,
} from "@/lib/task-incidents/validate-task-incident-input"
import type {
  AddIncidentEventRequest,
  AddIncidentPhotoRequest,
  CreateIncidentRequest,
  IncidentResponse,
  IncidentSummary,
  UpdateIncidentStatusRequest,
} from "@/lib/types/task-incidents"
import type { ListTaskIncidentsFilters } from "@/lib/types/supabase/task-incidents"

type ServiceContext = {
  companyId: string
  actorEmployeeId: string
  client: SupabaseTaskIncidentsClient
}

function throwIfRepositoryError<T>(
  result: { data: T | null; error: { code: string; message: string } | null }
): T {
  if (result.error || result.data === null) {
    throw mapRepositoryErrorToTaskIncidentError(
      result.error ?? {
        code: "UNKNOWN",
        message: "No fue posible completar la operación.",
      }
    )
  }

  return result.data
}

async function assertTaskExists(
  taskId: string,
  companyId: string,
  client: SupabaseTaskIncidentsClient
): Promise<void> {
  const { data, error } = await client
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw mapRepositoryErrorToTaskIncidentError({
      code: "UNKNOWN",
      message: error.message,
    })
  }

  if (!data) {
    throw new TaskIncidentError(
      "NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }
}

async function assertEmployeeExists(
  employeeId: string,
  companyId: string,
  client: SupabaseTaskIncidentsClient
): Promise<void> {
  const employeeResult = await getEmployeeById(employeeId, client)

  if (employeeResult.error || !employeeResult.data) {
    throw new TaskIncidentError(
      "NOT_FOUND",
      "Empleado no encontrado.",
      404
    )
  }

  if (employeeResult.data.companyId !== companyId) {
    throw new TaskIncidentError(
      "NOT_FOUND",
      "Empleado no encontrado.",
      404
    )
  }
}

async function assertIncidentTypeExists(
  incidentTypeId: string,
  companyId: string,
  client: SupabaseTaskIncidentsClient
): Promise<void> {
  const incidentTypeResult = await fetchIncidentTypeById(
    client,
    companyId,
    incidentTypeId
  )

  if (incidentTypeResult.error || !incidentTypeResult.data) {
    throw new TaskIncidentError(
      "NOT_FOUND",
      "Tipo de incidencia no encontrado.",
      404
    )
  }
}

async function assertNoActiveIncidentForTask(
  taskId: string,
  client: SupabaseTaskIncidentsClient
): Promise<void> {
  const activeResult = await findActiveTaskIncidentByTaskId(taskId, client)

  if (activeResult.error) {
    throw mapRepositoryErrorToTaskIncidentError(activeResult.error)
  }

  if (activeResult.data) {
    throw new TaskIncidentError(
      "DUPLICATE_ACTIVE",
      "Ya existe una incidencia activa para esta orden de trabajo.",
      409
    )
  }
}

async function loadIncidentResponse(
  incidentId: string,
  companyId: string,
  client: SupabaseTaskIncidentsClient
): Promise<IncidentResponse> {
  const detail = throwIfRepositoryError(
    await getTaskIncidentById(incidentId, companyId, client)
  )

  return mapTaskIncidentToResponse(detail)
}

export async function createTaskIncidentService(
  context: ServiceContext,
  request: CreateIncidentRequest
): Promise<IncidentResponse> {
  const validated = validateCreateIncidentRequest(request)
  const { client } = context

  await assertTaskExists(validated.taskId, context.companyId, client)
  await assertEmployeeExists(validated.employeeId, context.companyId, client)
  await assertIncidentTypeExists(
    validated.incidentTypeId,
    context.companyId,
    client
  )
  await assertNoActiveIncidentForTask(validated.taskId, client)

  const incident = throwIfRepositoryError(
    await createTaskIncidentRecord(
      {
        companyId: context.companyId,
        taskId: validated.taskId,
        employeeId: validated.employeeId,
        crewId: validated.crewId ?? null,
        incidentTypeId: validated.incidentTypeId,
        status: "REPORTADA",
        comment: validated.comment,
        canContinue: validated.canContinue,
        requiresSupervisorAction: validated.requiresSupervisorAction,
      },
      client
    )
  )

  throwIfRepositoryError(
    await addTaskIncidentEventRecord(
      {
        incidentId: incident.id,
        eventType: TASK_INCIDENT_EVENT_CREATED,
        comment: validated.comment,
        createdBy: context.actorEmployeeId,
      },
      client
    )
  )

  return loadIncidentResponse(incident.id, context.companyId, client)
}

export async function getTaskIncidentByIdService(
  context: ServiceContext,
  incidentId: string
): Promise<IncidentResponse> {
  const validatedId = validateIncidentIdParam(incidentId)
  return loadIncidentResponse(validatedId, context.companyId, context.client)
}

export async function listTaskIncidentsService(
  context: ServiceContext,
  filters?: ListTaskIncidentsFilters
): Promise<IncidentSummary[]> {
  const incidents = throwIfRepositoryError(
    await listTaskIncidents(context.companyId, filters, context.client)
  )

  return mapTaskIncidentsToSummaries(incidents)
}

export async function listActiveTaskIncidentsService(
  context: ServiceContext
): Promise<IncidentSummary[]> {
  const incidents = throwIfRepositoryError(
    await listActiveTaskIncidents(context.companyId, context.client)
  )

  return mapTaskIncidentsToSummaries(incidents)
}

export async function listTaskIncidentsByTaskIdService(
  context: ServiceContext,
  taskId: string
): Promise<IncidentSummary[]> {
  const validatedTaskId = validateIncidentIdParam(taskId)
  await assertTaskExists(validatedTaskId, context.companyId, context.client)

  const incidents = throwIfRepositoryError(
    await listTaskIncidentsByTaskId(
      validatedTaskId,
      context.companyId,
      context.client
    )
  )

  return mapTaskIncidentsToSummaries(incidents)
}

export async function updateTaskIncidentStatusService(
  context: ServiceContext,
  incidentId: string,
  request: UpdateIncidentStatusRequest
): Promise<IncidentResponse> {
  const validatedId = validateIncidentIdParam(incidentId)
  const validated = validateUpdateIncidentStatusRequest(request)
  const client = context.client

  const existing = throwIfRepositoryError(
    await getTaskIncidentById(validatedId, context.companyId, client)
  )

  assertValidStatusTransition(existing.status, validated.status)

  const resolvedAt = isTerminalTaskIncidentStatus(validated.status)
    ? new Date().toISOString()
    : null
  const resolvedBy = isTerminalTaskIncidentStatus(validated.status)
    ? context.actorEmployeeId
    : null

  throwIfRepositoryError(
    await updateTaskIncidentRecord(
      validatedId,
      {
        status: validated.status,
        comment:
          validated.comment !== undefined ? validated.comment : existing.comment,
        canContinue:
          validated.canContinue !== undefined
            ? validated.canContinue
            : existing.canContinue,
        requiresSupervisorAction:
          validated.requiresSupervisorAction !== undefined
            ? validated.requiresSupervisorAction
            : existing.requiresSupervisorAction,
        resolvedBy,
        resolvedAt,
      },
      client
    )
  )

  throwIfRepositoryError(
    await addTaskIncidentEventRecord(
      {
        incidentId: validatedId,
        eventType: TASK_INCIDENT_EVENT_STATUS_CHANGED,
        comment: validated.comment ?? `Estado actualizado a ${validated.status}.`,
        createdBy: context.actorEmployeeId,
      },
      client
    )
  )

  return loadIncidentResponse(validatedId, context.companyId, client)
}

export async function addTaskIncidentPhotoService(
  context: ServiceContext,
  incidentId: string,
  request: AddIncidentPhotoRequest
): Promise<IncidentResponse> {
  const validatedId = validateIncidentIdParam(incidentId)
  const validated = validateAddIncidentPhotoRequest(request)
  const client = context.client

  throwIfRepositoryError(
    await getTaskIncidentById(validatedId, context.companyId, client)
  )

  throwIfRepositoryError(
    await addTaskIncidentPhotoRecord(
      {
        incidentId: validatedId,
        storagePath: validated.storagePath,
        thumbnailPath: validated.thumbnailPath,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        createdBy: context.actorEmployeeId,
      },
      client
    )
  )

  return loadIncidentResponse(validatedId, context.companyId, client)
}

export async function addTaskIncidentEventService(
  context: ServiceContext,
  incidentId: string,
  request: AddIncidentEventRequest
): Promise<IncidentResponse> {
  const validatedId = validateIncidentIdParam(incidentId)
  const validated = validateAddIncidentEventRequest(request)
  const client = context.client

  throwIfRepositoryError(
    await getTaskIncidentById(validatedId, context.companyId, client)
  )

  throwIfRepositoryError(
    await addTaskIncidentEventRecord(
      {
        incidentId: validatedId,
        eventType: validated.eventType,
        comment: validated.comment,
        createdBy: context.actorEmployeeId,
      },
      client
    )
  )

  return loadIncidentResponse(validatedId, context.companyId, client)
}
