import { isManagedNetworkDevice } from "@/lib/network/devices/managed"
import {
  classifyNetworkInterfaceScope,
  pickNetworkObservationScope,
  type NetworkObservationScope,
} from "@/lib/network/discovery/interface-scope"

export type NetworkDiscoveryObservationSummary = {
  total: number
  core: number
  wan: number
  lanVlan: number
  unknown: number
}

export type NetworkObservationDeviceRow = {
  id: string
  companyId: string
  agentId: string | null
  managementIp: string | null
}

export type NetworkObservationTargetRow = {
  companyId: string
  agentId: string
  host: string
}

export type NetworkObservationLinkRow = {
  fromDeviceId: string
  toDeviceId: string
  fromInterfaceId: string | null
  toInterfaceId: string | null
}

export type NetworkObservationInterfaceRow = {
  id: string
  deviceId: string
  name: string
  description: string | null
  interfaceType: string | null
}

export function emptyNetworkDiscoveryObservationSummary(): NetworkDiscoveryObservationSummary {
  return { total: 0, core: 0, wan: 0, lanVlan: 0, unknown: 0 }
}

/**
 * Operational topology includes managed devices only.
 * Observed neighbors stay in inventory tables for a later accept flow.
 */
export function isOperationalTopologyDevice(input: {
  kind: "managed" | "neighbor"
}): boolean {
  return input.kind === "managed"
}

export function summarizeNetworkDiscoveryObservations(input: {
  devices: NetworkObservationDeviceRow[]
  targets: NetworkObservationTargetRow[]
  links: NetworkObservationLinkRow[]
  interfaces: NetworkObservationInterfaceRow[]
}): NetworkDiscoveryObservationSummary {
  const summary = emptyNetworkDiscoveryObservationSummary()
  summary.total = input.devices.length
  if (input.devices.length === 0) return summary

  const managedIds = new Set<string>()
  for (const device of input.devices) {
    const managed = input.targets.some((target) =>
      isManagedNetworkDevice(
        {
          companyId: device.companyId,
          agentId: device.agentId,
          managementIp: device.managementIp,
        },
        target
      )
    )
    if (managed) managedIds.add(device.id)
  }

  summary.core = managedIds.size

  const interfacesById = new Map(
    input.interfaces.map((iface) => [iface.id, iface] as const)
  )

  for (const device of input.devices) {
    if (managedIds.has(device.id)) continue
    const scope = classifyObservedNeighborScope({
      deviceId: device.id,
      managedIds,
      links: input.links,
      interfacesById,
    })
    if (scope === "wan") summary.wan += 1
    else if (scope === "lan" || scope === "vlan") summary.lanVlan += 1
    else summary.unknown += 1
  }

  return summary
}

function classifyObservedNeighborScope(input: {
  deviceId: string
  managedIds: Set<string>
  links: NetworkObservationLinkRow[]
  interfacesById: Map<string, NetworkObservationInterfaceRow>
}): NetworkObservationScope {
  const scopes: NetworkObservationScope[] = []
  for (const link of input.links) {
    const fromManaged = input.managedIds.has(link.fromDeviceId)
    const toManaged = input.managedIds.has(link.toDeviceId)
    const touches =
      link.fromDeviceId === input.deviceId || link.toDeviceId === input.deviceId
    if (!touches || fromManaged === toManaged) continue

    const interfaceId = fromManaged ? link.fromInterfaceId : link.toInterfaceId
    const iface = interfaceId ? input.interfacesById.get(interfaceId) : undefined
    scopes.push(
      classifyNetworkInterfaceScope({
        name: iface?.name,
        interfaceType: iface?.interfaceType,
        description: iface?.description,
      })
    )
  }
  return pickNetworkObservationScope(scopes)
}
