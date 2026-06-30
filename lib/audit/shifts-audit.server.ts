import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import type { WorkTeamShiftRecord } from "@/lib/work-team-shifts/types"

function mobileAuthToSessionUser(auth: MobileAuthContext): SessionUser {
  return {
    authUserId: auth.authUserId,
    employeeId: auth.employeeId,
    companyId: auth.companyId,
    displayName: auth.displayName,
    initials: auth.displayName.slice(0, 2).toUpperCase(),
    systemRole: auth.role,
    nationalId: null,
    mustChangePassword: false,
    email: auth.email,
  }
}

function buildShiftEntityLabel(workTeamName: string): string {
  return `Jornada — ${workTeamName}`
}

async function recordShiftAudit(
  action: typeof AUDIT_ACTIONS.SHIFT_STARTED | typeof AUDIT_ACTIONS.SHIFT_FINISHED,
  auth: MobileAuthContext,
  shift: WorkTeamShiftRecord,
  workTeamName: string
) {
  const entityLabel = buildShiftEntityLabel(workTeamName)

  await recordAuditEventServer({
    module: AUDIT_MODULES.SISTEMA,
    action,
    entityType: AUDIT_ENTITY_TYPES.WORK_TEAM_SHIFT,
    entityId: shift.id,
    entityLabel,
    description: buildAuditDescription({ action, entityLabel }),
    performedBy: {
      kind: "user",
      sessionUser: mobileAuthToSessionUser(auth),
    },
    metadata: {
      workTeamId: shift.workTeamId,
      workTeamName,
      mobileDeviceId: shift.mobileDeviceId,
      startedAt: shift.startedAt,
      finishedAt: shift.finishedAt,
      status: shift.status,
    },
  })
}

export async function recordShiftStartedAudit(
  auth: MobileAuthContext,
  shift: WorkTeamShiftRecord,
  workTeamName: string
) {
  await recordShiftAudit(AUDIT_ACTIONS.SHIFT_STARTED, auth, shift, workTeamName)
}

export async function recordShiftFinishedAudit(
  auth: MobileAuthContext,
  shift: WorkTeamShiftRecord,
  workTeamName: string
) {
  await recordShiftAudit(AUDIT_ACTIONS.SHIFT_FINISHED, auth, shift, workTeamName)
}
