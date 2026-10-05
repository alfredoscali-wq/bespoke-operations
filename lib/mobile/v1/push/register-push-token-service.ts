import "server-only"

import { randomUUID } from "node:crypto"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { fetchMobileDeviceByCompanyAndDeviceId } from "@/lib/mobile-devices/mobile-devices.queries"
import { MOBILE_DEVICE_STATUSES } from "@/lib/mobile-devices/types"
import {
  applyPushTokenRegistration,
  publicPushTokenRegistrationResult,
} from "@/lib/mobile/v1/push/apply-push-token-registration"
import {
  fetchActivePushTokensForCompany,
  persistPushTokenRows,
} from "@/lib/mobile/v1/push/push-token-queries"
import type {
  MobilePushTokenRequest,
  MobilePushTokenResponse,
} from "@/lib/mobile/v1/push/types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function registerMobilePushToken(
  auth: MobileAuthContext,
  request: MobilePushTokenRequest
): Promise<MobilePushTokenResponse> {
  const admin = createAdminClient()
  const device = await fetchMobileDeviceByCompanyAndDeviceId(
    admin,
    auth.companyId,
    request.deviceId
  )

  if (!device) {
    throw new MobileApiError(
      "DEVICE_NOT_FOUND",
      "Dispositivo no registrado.",
      404
    )
  }

  if (device.status !== MOBILE_DEVICE_STATUSES.ACTIVE) {
    throw new MobileApiError(
      "DEVICE_BLOCKED",
      "Dispositivo bloqueado.",
      403
    )
  }

  const now = new Date().toISOString()
  const existing = await fetchActivePushTokensForCompany(admin, auth.companyId)
  const next = applyPushTokenRegistration(existing, {
    companyId: auth.companyId,
    employeeId: auth.employeeId,
    deviceId: request.deviceId,
    platform: request.platform,
    pushToken: request.pushToken,
    now,
    newId: randomUUID(),
  })

  await persistPushTokenRows(admin, existing, next)
  return publicPushTokenRegistrationResult()
}
