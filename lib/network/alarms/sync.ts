import type { SupabaseClient } from "@supabase/supabase-js"

import { evaluateNetworkAlarmTransition } from "@/lib/network/alarms/evaluate"
import {
  applyNetworkAlarmActions,
  listActiveNetworkAlarms,
} from "@/lib/network/alarms/queries"
import { classifyNetworkAlarmRole } from "@/lib/network/alarms/role"
import { isManagedNetworkDevice } from "@/lib/network/devices/managed"
import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>

export type SyncNetworkAlarmsInput = {
  companyId: string
  deviceId: string
  previousStatus: string
  nextStatus: string
  occurredAt: string
}

const EMPTY_STATUS_BY_DEVICE = new Map<string, string>()
const EMPTY_ANCESTORS_BY_DEVICE = new Map<string, readonly string[]>()

export async function syncNetworkAlarmsAfterMonitoringTransition(
  client: Client,
  input: SyncNetworkAlarmsInput
): Promise<void> {
  if (input.previousStatus === input.nextStatus) return
  if (
    !(
      (input.previousStatus === "online" && input.nextStatus === "offline") ||
      (input.previousStatus === "offline" && input.nextStatus === "online")
    )
  ) {
    return
  }

  const [deviceResult, targetsResult, activeAlarms] = await Promise.all([
    client
      .from("network_devices")
      .select("id, company_id, agent_id, management_ip, device_type, hostname")
      .eq("company_id", input.companyId)
      .eq("id", input.deviceId)
      .is("deleted_at", null)
      .maybeSingle(),
    client
      .from("network_discovery_targets")
      .select("company_id, agent_id, host")
      .eq("company_id", input.companyId)
      .is("deleted_at", null),
    listActiveNetworkAlarms(client, input.companyId),
  ])

  if (deviceResult.error) throw new Error(deviceResult.error.message)
  if (targetsResult.error) throw new Error(targetsResult.error.message)

  const device = deviceResult.data
  if (!device) return

  const isManaged = (targetsResult.data ?? []).some((target) =>
    isManagedNetworkDevice(
      {
        companyId: device.company_id,
        agentId: device.agent_id,
        managementIp: device.management_ip,
      },
      {
        companyId: target.company_id,
        agentId: target.agent_id,
        host: target.host,
      }
    )
  )

  const role = classifyNetworkAlarmRole({
    isManaged,
    deviceType: device.device_type,
    managedAncestorCount: 0,
  })

  const activeAlarm =
    activeAlarms.find((alarm) => alarm.deviceId === input.deviceId) ?? null

  const actions = evaluateNetworkAlarmTransition({
    companyId: input.companyId,
    deviceId: input.deviceId,
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    now: input.occurredAt,
    role,
    identity: device.hostname ?? device.management_ip,
    activeAlarm,
    offlineAncestorRootAlarm: null,
    dependentsOfThisRoot: [],
    descendantActiveRootAlarms: [],
    statusByDeviceId: EMPTY_STATUS_BY_DEVICE,
    ancestorIdsByDeviceId: EMPTY_ANCESTORS_BY_DEVICE,
  })

  await applyNetworkAlarmActions(client, actions)
}
