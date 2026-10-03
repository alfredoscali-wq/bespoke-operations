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

export type NetworkDiscoveryObservationScopeKind = "core" | NetworkObservationScope

export type NetworkDiscoveryObservationItem = {
  id: string
  hostname: string | null
  managementIp: string | null
  macAddress: string | null
  observedInterfaceName: string | null
  observedInterfaceDescription: string | null
  scope: NetworkDiscoveryObservationScopeKind
  platform: string | null
  board: string | null
  version: string | null
  discoveredBy: string | null
  origin: string | null
}

export type NetworkDiscoveryObservationView = NetworkDiscoveryObservationSummary & {
  items: NetworkDiscoveryObservationItem[]
}

export type NetworkObservationDeviceRow = {
  id: string
  companyId: string
  agentId: string | null
  managementIp: string | null
  hostname?: string | null
  macAddress?: string | null
  manufacturer?: string | null
  model?: string | null
  firmwareVersion?: string | null
  origin?: string | null
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
  protocol?: string | null
}

export type NetworkObservationInterfaceRow = {
  id: string
  deviceId: string
  name: string
  description: string | null
  interfaceType: string | null
}

const OBSERVATION_SCOPE_RANK: Record<NetworkDiscoveryObservationScopeKind, number> = {
  core: 0,
  wan: 1,
  vlan: 2,
  lan: 3,
  unknown: 4,
}

export function emptyNetworkDiscoveryObservationSummary(): NetworkDiscoveryObservationSummary {
  return { total: 0, core: 0, wan: 0, lanVlan: 0, unknown: 0 }
}

export function emptyNetworkDiscoveryObservationView(): NetworkDiscoveryObservationView {
  return { ...emptyNetworkDiscoveryObservationSummary(), items: [] }
}

export function networkObservationGroupLabel(
  scope: NetworkDiscoveryObservationScopeKind
): "CORE" | "WAN" | "LAN/VLAN" | "UNKNOWN" {
  if (scope === "core") return "CORE"
  if (scope === "wan") return "WAN"
  if (scope === "lan" || scope === "vlan") return "LAN/VLAN"
  return "UNKNOWN"
}

export function formatObservedInterfaceLabel(
  name: string | null | undefined,
  description: string | null | undefined
): string | null {
  const interfaceName = name?.trim() || null
  const interfaceDescription = description?.trim() || null
  if (interfaceName && interfaceDescription) {
    if (interfaceName.toLowerCase().includes(interfaceDescription.toLowerCase())) {
      return interfaceName
    }
    return `${interfaceName} · ${interfaceDescription}`
  }
  return interfaceName ?? interfaceDescription
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
  return buildNetworkDiscoveryObservationView(input)
}

export function listNetworkDiscoveryObservationItems(input: {
  devices: NetworkObservationDeviceRow[]
  targets: NetworkObservationTargetRow[]
  links: NetworkObservationLinkRow[]
  interfaces: NetworkObservationInterfaceRow[]
}): NetworkDiscoveryObservationItem[] {
  return buildNetworkDiscoveryObservationView(input).items
}

export function buildNetworkDiscoveryObservationView(input: {
  devices: NetworkObservationDeviceRow[]
  targets: NetworkObservationTargetRow[]
  links: NetworkObservationLinkRow[]
  interfaces: NetworkObservationInterfaceRow[]
}): NetworkDiscoveryObservationView {
  const summary = emptyNetworkDiscoveryObservationSummary()
  summary.total = input.devices.length
  if (input.devices.length === 0) {
    return { ...summary, items: [] }
  }

  const managedIds = collectManagedDeviceIds(input.devices, input.targets)
  summary.core = managedIds.size

  const interfacesById = new Map(
    input.interfaces.map((iface) => [iface.id, iface] as const)
  )

  const items: NetworkDiscoveryObservationItem[] = []

  for (const device of input.devices) {
    if (managedIds.has(device.id)) {
      items.push(toObservationItem(device, { scope: "core" }))
      continue
    }

    const neighbor = resolveObservedNeighborContext({
      deviceId: device.id,
      managedIds,
      links: input.links,
      interfacesById,
    })
    if (neighbor.scope === "wan") summary.wan += 1
    else if (neighbor.scope === "lan" || neighbor.scope === "vlan") summary.lanVlan += 1
    else summary.unknown += 1

    items.push(toObservationItem(device, neighbor))
  }

  items.sort(compareObservationItems)
  return { ...summary, items }
}

function collectManagedDeviceIds(
  devices: NetworkObservationDeviceRow[],
  targets: NetworkObservationTargetRow[]
): Set<string> {
  const managedIds = new Set<string>()
  for (const device of devices) {
    const managed = targets.some((target) =>
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
  return managedIds
}

function toObservationItem(
  device: NetworkObservationDeviceRow,
  context: {
    scope: NetworkDiscoveryObservationScopeKind
    observedInterfaceName?: string | null
    observedInterfaceDescription?: string | null
    discoveredBy?: string | null
  }
): NetworkDiscoveryObservationItem {
  return {
    id: device.id,
    hostname: device.hostname ?? null,
    managementIp: device.managementIp,
    macAddress: device.macAddress ?? null,
    observedInterfaceName: context.observedInterfaceName ?? null,
    observedInterfaceDescription: context.observedInterfaceDescription ?? null,
    scope: context.scope,
    platform: device.manufacturer ?? null,
    board: device.model ?? null,
    version: device.firmwareVersion ?? null,
    discoveredBy: context.discoveredBy ?? null,
    origin: device.origin ?? null,
  }
}

function compareObservationItems(
  left: NetworkDiscoveryObservationItem,
  right: NetworkDiscoveryObservationItem
): number {
  const rank =
    OBSERVATION_SCOPE_RANK[left.scope] - OBSERVATION_SCOPE_RANK[right.scope]
  if (rank !== 0) return rank
  const leftLabel = left.hostname ?? left.managementIp ?? ""
  const rightLabel = right.hostname ?? right.managementIp ?? ""
  return leftLabel.localeCompare(rightLabel, "es")
}

function resolveObservedNeighborContext(input: {
  deviceId: string
  managedIds: Set<string>
  links: NetworkObservationLinkRow[]
  interfacesById: Map<string, NetworkObservationInterfaceRow>
}): {
  scope: NetworkObservationScope
  observedInterfaceName: string | null
  observedInterfaceDescription: string | null
  discoveredBy: string | null
} {
  const candidates: {
    scope: NetworkObservationScope
    iface: NetworkObservationInterfaceRow | undefined
    protocol: string | null
  }[] = []

  for (const link of input.links) {
    const fromManaged = input.managedIds.has(link.fromDeviceId)
    const toManaged = input.managedIds.has(link.toDeviceId)
    const touches =
      link.fromDeviceId === input.deviceId || link.toDeviceId === input.deviceId
    if (!touches || fromManaged === toManaged) continue

    const interfaceId = fromManaged ? link.fromInterfaceId : link.toInterfaceId
    const iface = interfaceId ? input.interfacesById.get(interfaceId) : undefined
    candidates.push({
      scope: classifyNetworkInterfaceScope({
        name: iface?.name,
        interfaceType: iface?.interfaceType,
        description: iface?.description,
      }),
      iface,
      protocol: link.protocol ?? null,
    })
  }

  if (candidates.length === 0) {
    return {
      scope: "unknown",
      observedInterfaceName: null,
      observedInterfaceDescription: null,
      discoveredBy: null,
    }
  }

  const scope = pickNetworkObservationScope(candidates.map((item) => item.scope))
  const winner = candidates.find((item) => item.scope === scope) ?? candidates[0]
  return {
    scope,
    observedInterfaceName: winner.iface?.name ?? null,
    observedInterfaceDescription: winner.iface?.description ?? null,
    discoveredBy: winner.protocol,
  }
}
