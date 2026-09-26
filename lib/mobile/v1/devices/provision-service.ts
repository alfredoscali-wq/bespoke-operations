import "server-only"

import { recordMobileDeviceRegisteredAudit } from "@/lib/audit/devices-audit.server"
import { decideDemoMobileDeviceCrewBinding } from "@/lib/demo/bind-demo-mobile-device"
import { BESPOKE_DEMO_COMPANY_ID } from "@/lib/demo/constants"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import type {
  MobileProvisionDeviceRequest,
  MobileProvisionDeviceResponse,
} from "@/lib/mobile/v1/devices/types"
import {
  assignMobileDeviceWorkTeam,
  upsertMobileDeviceProvision,
} from "@/lib/mobile-devices/mobile-devices.queries"
import { fetchCrewsForEmployeeMembership } from "@/lib/supabase/crews.queries"
import { createAdminClient } from "@/lib/supabase/admin"

async function maybeBindDemoDeviceToCrew(
  admin: ReturnType<typeof createAdminClient>,
  auth: MobileAuthContext,
  device: Awaited<
    ReturnType<typeof upsertMobileDeviceProvision>
  >["device"]
) {
  if (auth.companyId !== BESPOKE_DEMO_COMPANY_ID) {
    return device
  }

  const crewsResult = await fetchCrewsForEmployeeMembership(
    admin,
    auth.companyId,
    auth.employeeId
  )

  const decision = decideDemoMobileDeviceCrewBinding({
    authCompanyId: auth.companyId,
    deviceWorkTeamId: device.workTeamId,
    employeeCrews: (crewsResult.data ?? []).map((crew) => ({
      id: crew.id,
      companyId: auth.companyId,
      name: crew.name,
    })),
  })

  if (decision.action !== "bind") {
    return device
  }

  return assignMobileDeviceWorkTeam(admin, {
    companyId: auth.companyId,
    deviceRecordId: device.id,
    workTeamId: decision.workTeamId,
  })
}

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

  const bound = await maybeBindDemoDeviceToCrew(admin, auth, device)

  if (created) {
    try {
      await recordMobileDeviceRegisteredAudit(auth, bound)
    } catch {
      // Provisioning succeeded; audit failure must not block mobile clients.
    }
  }

  const authorized = bound.status === "ACTIVE"

  return {
    authorized,
    status: bound.status,
  }
}
