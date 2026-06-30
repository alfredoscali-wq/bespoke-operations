import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  type AuditAction,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import type { MobileDeviceRecord } from "@/lib/mobile-devices/types"

function buildMobileDeviceLabel(device: MobileDeviceRecord): string {
  const model = [device.manufacturer, device.model].filter(Boolean).join(" ").trim()
  return model ? `${model} (${device.deviceId})` : device.deviceId
}

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

async function recordMobileDeviceAudit(
  action: AuditAction,
  auth: MobileAuthContext | SessionUser,
  device: MobileDeviceRecord,
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  const entityLabel = buildMobileDeviceLabel(device)
  const performedBy =
    "authUserId" in auth && "role" in auth
      ? { kind: "user" as const, sessionUser: mobileAuthToSessionUser(auth) }
      : { kind: "user" as const, sessionUser: auth as SessionUser }

  await recordAuditEventServer({
    module: AUDIT_MODULES.SISTEMA,
    action,
    entityType: AUDIT_ENTITY_TYPES.MOBILE_DEVICE,
    entityId: device.id,
    entityLabel,
    description: buildAuditDescription({ action, entityLabel }),
    performedBy,
    metadata: {
      deviceId: device.deviceId,
      manufacturer: device.manufacturer,
      model: device.model,
      androidVersion: device.androidVersion,
      appVersion: device.appVersion,
      platform: device.platform,
      status: device.status,
    },
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
  })
}

export async function recordMobileDeviceRegisteredAudit(
  auth: MobileAuthContext,
  device: MobileDeviceRecord
) {
  await recordMobileDeviceAudit(
    AUDIT_ACTIONS.MOBILE_DEVICE_REGISTERED,
    auth,
    device
  )
}

export async function recordMobileDeviceActivatedAudit(
  sessionUser: SessionUser,
  device: MobileDeviceRecord,
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  await recordMobileDeviceAudit(
    AUDIT_ACTIONS.MOBILE_DEVICE_ACTIVATED,
    sessionUser,
    device,
    context
  )
}

export async function recordMobileDeviceBlockedAudit(
  sessionUser: SessionUser,
  device: MobileDeviceRecord,
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  await recordMobileDeviceAudit(
    AUDIT_ACTIONS.MOBILE_DEVICE_BLOCKED,
    sessionUser,
    device,
    context
  )
}

export { buildMobileDeviceLabel }
