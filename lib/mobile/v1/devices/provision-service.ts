import "server-only"

import { recordMobileDeviceRegisteredAudit } from "@/lib/audit/devices-audit.server"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import type {
  MobileProvisionDeviceRequest,
  MobileProvisionDeviceResponse,
} from "@/lib/mobile/v1/devices/types"
import { upsertMobileDeviceProvision } from "@/lib/mobile-devices/mobile-devices.queries"
import { createAdminClient } from "@/lib/supabase/admin"

export async function provisionMobileDevice(
  auth: MobileAuthContext,
  request: MobileProvisionDeviceRequest
): Promise<MobileProvisionDeviceResponse> {
  const admin = createAdminClient()
  const { device, created } = await upsertMobileDeviceProvision(admin, {
    companyId: auth.companyId,
    deviceId: request.deviceId,
    manufacturer: request.manufacturer,
    model: request.model,
    androidVersion: request.androidVersion,
    appVersion: request.appVersion,
    platform: request.platform,
  })

  if (created) {
    try {
      await recordMobileDeviceRegisteredAudit(auth, device)
    } catch {
      // Provisioning succeeded; audit failure must not block mobile clients.
    }
  }

  const authorized = device.status === "ACTIVE"

  return {
    authorized,
    status: device.status,
  }
}
