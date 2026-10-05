import "server-only"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { requireEmployee } from "@/lib/mobile/v1/auth/mobile-auth-helpers"
import {
  assertCanReadMobileNetworkAlarms,
  resolveMobileNetworkAlarmsCompanyId,
} from "@/lib/mobile/v1/alarms/can-read-mobile-network-alarms"
import {
  mapMobileNetworkAlarm,
  type MobileNetworkAlarm,
} from "@/lib/mobile/v1/alarms/map-mobile-network-alarm"
import { listNetworkAlarms } from "@/lib/network/alarms/queries"
import { createAdminClient } from "@/lib/supabase/admin"

export async function listMobileNetworkAlarms(
  auth: MobileAuthContext,
  requestedCompanyId?: string | null
): Promise<{ alarms: MobileNetworkAlarm[] }> {
  requireEmployee(auth)
  const companyId = resolveMobileNetworkAlarmsCompanyId(
    auth.companyId,
    requestedCompanyId
  )
  assertCanReadMobileNetworkAlarms(auth.role)

  const client = createAdminClient()
  const alarms = await listNetworkAlarms(client, companyId)
  return {
    alarms: alarms.map(mapMobileNetworkAlarm),
  }
}
