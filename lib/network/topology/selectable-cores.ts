import { isManagedNetworkDevice } from "@/lib/network/devices/managed"
import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"
import type { LocalTopologyCoreOption } from "@/lib/network/topology/local-view"

export type SelectableTopologyCoreDevice = {
  id: string
  companyId: string
  agentId: string | null
  managementIp: string | null
  hostname: string | null
  operationalStatus?: MonitoringOperationalStatus | null
  deletedAt?: string | null
}

export type SelectableTopologyCoreTarget = {
  companyId: string
  agentId: string
  host: string
  deletedAt?: string | null
}

/**
 * Cores that can be selected in Topology.
 * Eligibility is an active Discovery target of the same company:
 * company_id + agent_id + management_ip. MNDP links are not an input.
 */
export function selectSelectableTopologyCores(
  devices: readonly SelectableTopologyCoreDevice[],
  targets: readonly SelectableTopologyCoreTarget[]
): LocalTopologyCoreOption[] {
  const activeTargets = targets.filter((target) => target.deletedAt == null)
  const seen = new Set<string>()
  const cores: LocalTopologyCoreOption[] = []

  for (const device of devices) {
    if (device.deletedAt) continue
    if (seen.has(device.id)) continue
    const matches = activeTargets.some((target) =>
      isManagedNetworkDevice(
        {
          companyId: device.companyId,
          agentId: device.agentId,
          managementIp: device.managementIp,
        },
        target
      )
    )
    if (!matches) continue
    seen.add(device.id)
    cores.push({
      id: device.id,
      hostname: device.hostname,
      managementIp: device.managementIp,
      operationalStatus: device.operationalStatus ?? null,
    })
  }

  return cores
}
