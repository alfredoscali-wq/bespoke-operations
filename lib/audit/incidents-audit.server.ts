import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import {
  buildIncidentClosedDescription,
  buildIncidentClosedMetadata,
  buildIncidentCreatedDescription,
  buildIncidentCreatedMetadata,
  buildIncidentSupervisorActionDescription,
  buildIncidentSupervisorActionMetadata,
  mapIncidentEventTypeToSupervisorAction,
  resolveIncidentAuditEntityLabel,
  resolveSupervisorActionResultStatus,
  resolveTaskCodeFromTask,
  type IncidentAuditMetadataBase,
  type IncidentSupervisorAction,
} from "@/lib/audit/incidents-audit.shared"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import { logOperationError } from "@/lib/operations/user-messages"
import { fetchIncidentTypeById } from "@/lib/supabase/incident-types.queries"
import { getEmployeeById } from "@/lib/supabase/employees.repository"
import { fetchTaskById } from "@/lib/supabase/tasks.queries"
import type { SupabaseTaskIncidentsClient } from "@/lib/supabase/task-incidents.repository"
import { getTaskIncidentById } from "@/lib/supabase/task-incidents.repository"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { buildSessionRoleContext } from "@/lib/roles/session-role"
import type { TaskIncidentStatus } from "@/lib/types/task-incidents"
import type { Task } from "@/lib/types/tasks"

function mobileAuthToSessionUser(auth: MobileAuthContext): SessionUser {
  const sessionRole = buildSessionRoleContext({ employee: null, role: null })

  return {
    authUserId: auth.authUserId,
    employeeId: auth.employeeId,
    companyId: auth.companyId,
    displayName: auth.displayName,
    initials: auth.displayName.slice(0, 2).toUpperCase(),
    systemRole: auth.role,
    roleId: null,
    roleCode: null,
    roleName: null,
    moduleVisibility: sessionRole.moduleVisibility,
    visibleModuleKeys: sessionRole.visibleModuleKeys,
    nationalId: null,
    mustChangePassword: false,
    email: auth.email,
  }
}

async function loadIncidentAuditBase(input: {
  companyId: string
  incidentId: string
  client: SupabaseTaskIncidentsClient
}): Promise<IncidentAuditMetadataBase | null> {
  const incidentResult = await getTaskIncidentById(
    input.incidentId,
    input.companyId,
    input.client
  )

  if (incidentResult.error || !incidentResult.data) {
    return null
  }

  const incident = incidentResult.data
  const [taskResult, incidentTypeResult] = await Promise.all([
    fetchTaskById(input.client, incident.taskId),
    fetchIncidentTypeById(input.client, input.companyId, incident.incidentTypeId),
  ])

  const taskCode = taskResult.data
    ? resolveTaskCodeFromTask(taskResult.data)
    : null

  return {
    incidentId: incident.id,
    taskId: incident.taskId,
    taskCode,
    incidentTypeId: incident.incidentTypeId,
    incidentTypeLabel: incidentTypeResult.data?.name ?? null,
    incidentTypeCode: incidentTypeResult.data?.code ?? null,
  }
}

async function recordIncidentAuditBestEffort(
  writer: () => Promise<void>,
  context: string
): Promise<void> {
  try {
    await writer()
  } catch (error) {
    logOperationError(context, error)
  }
}

export async function recordIncidentCreatedAudit(input: {
  auth: MobileAuthContext
  incidentId: string
  taskId: string
  task: Pick<Task, "workOrderNumber" | "code" | "title">
  incidentTypeId: string
  incidentTypeLabel?: string | null
  incidentTypeCode?: string | null
  comment?: string | null
  crewId?: string | null
  workTeamId?: string | null
  mobileDeviceId?: string | null
  employeeName?: string | null
}): Promise<void> {
  const taskCode = resolveTaskCodeFromTask(input.task)
  const entityLabel = resolveIncidentAuditEntityLabel({
    taskCode,
    incidentId: input.incidentId,
  })

  await recordIncidentAuditBestEffort(async () => {
    await recordAuditEventServer({
      module: AUDIT_MODULES.TAREAS,
      action: AUDIT_ACTIONS.INCIDENT_CREATED,
      entityType: AUDIT_ENTITY_TYPES.INCIDENT,
      entityId: input.incidentId,
      entityLabel,
      description: buildIncidentCreatedDescription(taskCode),
      performedBy: {
        kind: "user",
        sessionUser: mobileAuthToSessionUser(input.auth),
      },
      metadata: buildIncidentCreatedMetadata({
        incidentId: input.incidentId,
        taskId: input.taskId,
        taskCode,
        incidentTypeId: input.incidentTypeId,
        incidentTypeLabel: input.incidentTypeLabel,
        incidentTypeCode: input.incidentTypeCode,
        comment: input.comment,
        employeeId: input.auth.employeeId,
        employeeName: input.employeeName ?? input.auth.displayName,
        crewId: input.crewId ?? null,
        workTeamId: input.workTeamId ?? null,
        mobileDeviceId: input.mobileDeviceId ?? null,
      }),
    })
  }, "Incident created audit")
}

export async function recordIncidentSupervisorActionAudit(input: {
  sessionUser: SessionUser
  companyId: string
  incidentId: string
  client: SupabaseTaskIncidentsClient
  supervisorAction: IncidentSupervisorAction
  previousIncidentStatus: TaskIncidentStatus
  note?: string | null
  previousDueDate?: string | null
  newDueDate?: string | null
  previousCrewId?: string | null
  newCrewId?: string | null
  previousCrewName?: string | null
  newCrewName?: string | null
}): Promise<void> {
  const base = await loadIncidentAuditBase({
    companyId: input.companyId,
    incidentId: input.incidentId,
    client: input.client,
  })

  if (!base) {
    return
  }

  const entityLabel = resolveIncidentAuditEntityLabel({
    taskCode: base.taskCode,
    incidentId: input.incidentId,
  })
  const nextIncidentStatus = resolveSupervisorActionResultStatus(
    input.supervisorAction,
    input.previousIncidentStatus
  )

  await recordIncidentAuditBestEffort(async () => {
    await recordAuditEventServer({
      module: AUDIT_MODULES.TAREAS,
      action: AUDIT_ACTIONS.INCIDENT_SUPERVISOR_ACTION,
      entityType: AUDIT_ENTITY_TYPES.INCIDENT,
      entityId: input.incidentId,
      entityLabel,
      description: buildIncidentSupervisorActionDescription(
        input.supervisorAction,
        base.taskCode
      ),
      performedBy: { kind: "user", sessionUser: input.sessionUser },
      metadata: buildIncidentSupervisorActionMetadata({
        base,
        supervisorAction: input.supervisorAction,
        previousIncidentStatus: input.previousIncidentStatus,
        nextIncidentStatus,
        actorEmployeeId: input.sessionUser.employeeId ?? "",
        actorName: input.sessionUser.displayName,
        note: input.note,
        previousDueDate: input.previousDueDate,
        newDueDate: input.newDueDate,
        previousCrewId: input.previousCrewId,
        newCrewId: input.newCrewId,
        previousCrewName: input.previousCrewName,
        newCrewName: input.newCrewName,
      }),
    })
  }, "Incident supervisor action audit")
}

export async function recordIncidentSupervisorActionFromEventType(input: {
  sessionUser: SessionUser
  companyId: string
  incidentId: string
  client: SupabaseTaskIncidentsClient
  eventType: string
  previousIncidentStatus: TaskIncidentStatus
  note?: string | null
}): Promise<void> {
  const supervisorAction = mapIncidentEventTypeToSupervisorAction(input.eventType)

  if (!supervisorAction) {
    return
  }

  await recordIncidentSupervisorActionAudit({
    sessionUser: input.sessionUser,
    companyId: input.companyId,
    incidentId: input.incidentId,
    client: input.client,
    supervisorAction,
    previousIncidentStatus: input.previousIncidentStatus,
    note: input.note,
  })
}

export async function recordIncidentClosedAudit(input: {
  sessionUser: SessionUser
  companyId: string
  incidentId: string
  client: SupabaseTaskIncidentsClient
  previousIncidentStatus: TaskIncidentStatus
  closureResult: TaskIncidentStatus
  note?: string | null
}): Promise<void> {
  if (input.closureResult !== "RESUELTA" && input.closureResult !== "RECHAZADA") {
    return
  }

  const base = await loadIncidentAuditBase({
    companyId: input.companyId,
    incidentId: input.incidentId,
    client: input.client,
  })

  if (!base) {
    return
  }

  const entityLabel = resolveIncidentAuditEntityLabel({
    taskCode: base.taskCode,
    incidentId: input.incidentId,
  })

  await recordIncidentAuditBestEffort(async () => {
    await recordAuditEventServer({
      module: AUDIT_MODULES.TAREAS,
      action: AUDIT_ACTIONS.INCIDENT_CLOSED,
      entityType: AUDIT_ENTITY_TYPES.INCIDENT,
      entityId: input.incidentId,
      entityLabel,
      description: buildIncidentClosedDescription(
        input.closureResult,
        base.taskCode
      ),
      performedBy: { kind: "user", sessionUser: input.sessionUser },
      metadata: buildIncidentClosedMetadata({
        base,
        closureResult: input.closureResult,
        previousIncidentStatus: input.previousIncidentStatus,
        actorEmployeeId: input.sessionUser.employeeId ?? "",
        actorName: input.sessionUser.displayName,
        note: input.note,
      }),
    })
  }, "Incident closed audit")
}

export async function resolveMobileReporterName(input: {
  employeeId: string
  client: SupabaseTaskIncidentsClient
}): Promise<string | null> {
  const employeeResult = await getEmployeeById(input.employeeId, input.client)

  if (employeeResult.error || !employeeResult.data) {
    return null
  }

  const employee = employeeResult.data
  return (
    employee.preferredName?.trim() ||
    `${employee.firstName} ${employee.lastName}`.trim() ||
    null
  )
}

export function buildIncidentCreatedAuditDescriptionForCatalog(
  entityLabel?: string | null
): string {
  return buildAuditDescription({
    action: AUDIT_ACTIONS.INCIDENT_CREATED,
    entityLabel,
  })
}
