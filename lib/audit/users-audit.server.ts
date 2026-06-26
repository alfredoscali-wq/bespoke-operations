import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import {
  buildUserRoleMetadata,
  resolveUserEntityId,
  resolveUserEntityLabel,
} from "@/lib/audit/users-audit"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  type AuditAction,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import type { Employee, SystemRole, UpdateEmployeeInput } from "@/lib/types/employees"

type WriteUserAuditInput = {
  action: AuditAction
  entityType: typeof AUDIT_ENTITY_TYPES.USER | typeof AUDIT_ENTITY_TYPES.SESSION
  entityId?: string | null
  entityLabel?: string | null
  performedBy: SessionUser
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export async function writeUserAuditEvent(input: WriteUserAuditInput) {
  const entityLabel = input.entityLabel?.trim() || null

  await recordAuditEventServer({
    module: AUDIT_MODULES.USUARIOS,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel,
    description: buildAuditDescription({
      action: input.action,
      entityLabel,
    }),
    performedBy: { kind: "user", sessionUser: input.performedBy },
    metadata: input.metadata,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
}

export async function recordUserLoginAudit(
  sessionUser: SessionUser,
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_LOGIN,
    entityType: AUDIT_ENTITY_TYPES.SESSION,
    entityId: sessionUser.authUserId,
    entityLabel: sessionUser.displayName,
    performedBy: sessionUser,
    metadata: {
      employeeId: sessionUser.employeeId,
      systemRole: sessionUser.systemRole,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  })
}

export async function recordUserLogoutAudit(
  sessionUser: SessionUser,
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_LOGOUT,
    entityType: AUDIT_ENTITY_TYPES.SESSION,
    entityId: sessionUser.authUserId,
    entityLabel: sessionUser.displayName,
    performedBy: sessionUser,
    metadata: {
      employeeId: sessionUser.employeeId,
      systemRole: sessionUser.systemRole,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  })
}

export async function recordUserCreateAudit(input: {
  performedBy: SessionUser
  employee: Pick<
    Employee,
    "id" | "employeeCode" | "firstName" | "lastName" | "preferredName" | "systemRole"
  >
  authUserId: string
}) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_CREATE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: input.authUserId,
    entityLabel: resolveUserEntityLabel(input.employee),
    performedBy: input.performedBy,
    metadata: {
      employeeId: input.employee.id,
      authUserId: input.authUserId,
      systemRole: input.employee.systemRole,
    },
  })
}

export async function recordUserProvisionAudit(input: {
  performedBy: SessionUser
  employee: Pick<
    Employee,
    "id" | "employeeCode" | "firstName" | "lastName" | "preferredName" | "systemRole"
  >
  authUserId: string
}) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_PROVISION,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: input.authUserId,
    entityLabel: resolveUserEntityLabel(input.employee),
    performedBy: input.performedBy,
    metadata: {
      employeeId: input.employee.id,
      authUserId: input.authUserId,
      systemRole: input.employee.systemRole,
    },
  })
}

export async function recordUserPasswordResetAudit(input: {
  performedBy: SessionUser
  employee: Pick<
    Employee,
    | "id"
    | "employeeCode"
    | "firstName"
    | "lastName"
    | "preferredName"
    | "appUserId"
    | "systemRole"
  >
}) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: resolveUserEntityId(input.employee),
    entityLabel: resolveUserEntityLabel(input.employee),
    performedBy: input.performedBy,
    metadata: {
      employeeId: input.employee.id,
      authUserId: input.employee.appUserId ?? null,
      systemRole: input.employee.systemRole,
    },
  })
}

export async function recordUserRoleChangeAudit(input: {
  performedBy: SessionUser
  employee: Pick<
    Employee,
    "id" | "employeeCode" | "firstName" | "lastName" | "preferredName" | "appUserId"
  >
  previousRole: SystemRole
  nextRole: SystemRole
}) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: resolveUserEntityId(input.employee),
    entityLabel: resolveUserEntityLabel(input.employee),
    performedBy: input.performedBy,
    metadata: {
      employeeId: input.employee.id,
      authUserId: input.employee.appUserId ?? null,
      ...buildUserRoleMetadata(input.previousRole, input.nextRole),
    },
  })
}

export async function recordUserDeactivateAudit(input: {
  performedBy: SessionUser
  employee: Pick<
    Employee,
    "id" | "employeeCode" | "firstName" | "lastName" | "preferredName" | "appUserId"
  >
}) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_DEACTIVATE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: resolveUserEntityId(input.employee),
    entityLabel: resolveUserEntityLabel(input.employee),
    performedBy: input.performedBy,
    metadata: {
      employeeId: input.employee.id,
      authUserId: input.employee.appUserId ?? null,
    },
  })
}

export async function recordUserReactivateAudit(input: {
  performedBy: SessionUser
  employee: Pick<
    Employee,
    "id" | "employeeCode" | "firstName" | "lastName" | "preferredName" | "appUserId"
  >
}) {
  await writeUserAuditEvent({
    action: AUDIT_ACTIONS.USER_REACTIVATE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: resolveUserEntityId(input.employee),
    entityLabel: resolveUserEntityLabel(input.employee),
    performedBy: input.performedBy,
    metadata: {
      employeeId: input.employee.id,
      authUserId: input.employee.appUserId ?? null,
    },
  })
}

export async function recordUserAccountChangesAudit(input: {
  performedBy: SessionUser
  before: Employee
  after: Employee
  changes: UpdateEmployeeInput
}) {
  const accessDeactivated =
    input.changes.systemAccess !== undefined &&
    input.before.systemAccess &&
    !input.after.systemAccess

  const accessReactivated =
    input.changes.systemAccess !== undefined &&
    !input.before.systemAccess &&
    input.after.systemAccess

  const roleChanged =
    input.changes.systemRole !== undefined &&
    input.before.systemRole !== input.after.systemRole

  if (accessDeactivated) {
    await recordUserDeactivateAudit({
      performedBy: input.performedBy,
      employee: input.before,
    })
    return
  }

  if (accessReactivated) {
    await recordUserReactivateAudit({
      performedBy: input.performedBy,
      employee: input.after,
    })
    return
  }

  if (roleChanged) {
    await recordUserRoleChangeAudit({
      performedBy: input.performedBy,
      employee: input.after,
      previousRole: input.before.systemRole,
      nextRole: input.after.systemRole,
    })
  }
}

export { buildUserRoleMetadata, resolveUserEntityId, resolveUserEntityLabel }
