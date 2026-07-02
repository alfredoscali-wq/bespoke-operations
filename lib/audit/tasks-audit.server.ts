import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import { buildTaskStatusMetadata } from "@/lib/audit/tasks-audit-shared"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { buildSessionRoleContext } from "@/lib/roles/session-role"
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

export async function recordTaskMobileStartAudit(input: {
  auth: MobileAuthContext
  before: Task
  after: Task
  workTeamId: string
  workTeamName: string
  mobileDeviceId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  distanceToClientMeters: number
  startedAt: string
}) {
  const entityLabel =
    input.after.workOrderNumber?.trim() ||
    input.after.code?.trim() ||
    input.after.title?.trim() ||
    input.after.id

  await recordAuditEventServer({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.TASK_STATUS_EN_CURSO,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.after.id,
    entityLabel,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.TASK_STATUS_EN_CURSO,
      entityLabel,
    }),
    performedBy: {
      kind: "user",
      sessionUser: mobileAuthToSessionUser(input.auth),
    },
    metadata: {
      ...buildTaskStatusMetadata(input.before, input.after),
      workflowAction: "start",
      source: "mobile-field-agent",
      workTeamId: input.workTeamId,
      workTeamName: input.workTeamName,
      mobileDeviceId: input.mobileDeviceId,
      startedBy: input.auth.employeeId,
      startedAt: input.startedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      distanceToClientMeters: input.distanceToClientMeters,
    },
  })
}

export async function recordTaskMobileWorkflowAudit(input: {
  auth: MobileAuthContext
  before: Task
  after: Task
  workflowAction: string
  workTeamId: string
  workTeamName: string
  mobileDeviceId: string
  note?: string
}) {
  const entityLabel =
    input.after.workOrderNumber?.trim() ||
    input.after.code?.trim() ||
    input.after.title?.trim() ||
    input.after.id

  await recordAuditEventServer({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.TASK_STATUS_EN_CURSO,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.after.id,
    entityLabel,
    description: input.note?.trim()
      ? input.note.trim()
      : buildAuditDescription({
          action: AUDIT_ACTIONS.TASK_STATUS_EN_CURSO,
          entityLabel,
        }),
    performedBy: {
      kind: "user",
      sessionUser: mobileAuthToSessionUser(input.auth),
    },
    metadata: {
      ...buildTaskStatusMetadata(input.before, input.after),
      workflowAction: input.workflowAction,
      source: "mobile-field-agent",
      workTeamId: input.workTeamId,
      workTeamName: input.workTeamName,
      mobileDeviceId: input.mobileDeviceId,
    },
  })
}
