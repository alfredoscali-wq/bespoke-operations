import type { NetworkDeviceType } from "@/lib/network/constants"
import {
  formatObservedInterfaceLabel,
  type NetworkDiscoveryObservationItem,
} from "@/lib/network/discovery/observations"
import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"

export type LocalTopologyObservedDevice = {
  id: string
  hostname: string | null
  managementIp: string | null
  macAddress: string | null
  platform: string | null
  board: string | null
  version: string | null
  discoveredBy: string | null
  origin: string | null
  observedInterfaceName: string | null
  lastSeenAt: string | null
  deviceType: NetworkDeviceType | null
  operationalStatus: MonitoringOperationalStatus | null
  lastPollAt: string | null
  managed: boolean
  downstream: LocalTopologyInterfaceGroup[]
  agentId: string | null
}

export type LocalTopologyInterfaceGroup = {
  interfaceName: string | null
  interfaceDescription: string | null
  interfaceLabel: string
  devices: LocalTopologyObservedDevice[]
  cpes: LocalTopologyObservedDevice[]
  cpeCount: number
}

export type LocalCoreTopologyView = {
  core: {
    id: string
    hostname: string | null
    managementIp: string | null
    operationalStatus: MonitoringOperationalStatus | null
    lastPollAt: string | null
  }
  jobId: string | null
  interfaceGroups: LocalTopologyInterfaceGroup[]
  cpeObservedCount: number
}

export type LocalTopologyCoreOption = {
  id: string
  hostname: string | null
  managementIp: string | null
  operationalStatus: MonitoringOperationalStatus | null
}

export type LocalTopologyLinkRow = {
  fromDeviceId: string
  toDeviceId: string
  fromInterfaceName?: string | null
}

export type LocalTopologyInterfaceRow = {
  deviceId: string
  name: string
  description: string | null
}

const CPE_TYPE = new Set(["cpe", "onu"])
const INFRA_TYPE = new Set(["core", "switch", "olt"])
const CPE_TOKEN = /\b(hap|cpe|onu)\b/
const INFRA_IDENTITY = /^(as\s*\d+|powerbox)\b/i
const INFRA_BOARD = /\b(crs|ccr|css|netpower|powerbox|netmetal)\b|\brb\d/
const GENERIC_HOSTNAME = /^(mikrotik|router|switch|ap|cpe|onu|unknown|rb|hap)$/i

export function isNamedLanInfrastructure(input: {
  hostname?: string | null
  board?: string | null
}): boolean {
  const hostname = input.hostname?.trim() ?? ""
  if (INFRA_IDENTITY.test(hostname)) return true
  const board = `${input.board ?? ""}`.toLowerCase()
  if (CPE_TOKEN.test(board)) return false
  return INFRA_BOARD.test(board)
}

export function isLocalTopologyInfrastructure(input: {
  hostname?: string | null
  board?: string | null
  deviceType?: string | null
}): boolean {
  const type = input.deviceType?.trim().toLowerCase() ?? ""
  if (CPE_TYPE.has(type)) return false
  if (isNamedLanInfrastructure(input)) return true
  return INFRA_TYPE.has(type)
}

export function isLikelyCustomerCpe(input: {
  deviceType?: string | null
  board?: string | null
  hostname?: string | null
}): boolean {
  return !isLocalTopologyInfrastructure(input)
}

export function localObservedInterfaceName(input: {
  coreId: string
  deviceId: string
  links: readonly LocalTopologyLinkRow[]
  fallback?: string | null
}): string | null {
  for (const link of input.links) {
    if (link.fromDeviceId !== input.coreId || link.toDeviceId !== input.deviceId) {
      continue
    }
    const name = link.fromInterfaceName?.trim()
    if (name) return name
  }
  const fallback = input.fallback?.trim()
  return fallback ? fallback : null
}

export function visualDedupeKey(input: {
  macAddress?: string | null
  managementIp?: string | null
  hostname?: string | null
  interfaceName?: string | null
}): string | null {
  const mac = exactMac(input.macAddress)
  if (mac) return `mac:${mac}`
  const ip = input.managementIp?.trim().toLowerCase()
  if (ip) return `ip:${ip}`
  const hostname = input.hostname?.trim()
  if (!hostname || GENERIC_HOSTNAME.test(hostname)) return null
  const iface = input.interfaceName?.trim().toLowerCase() ?? ""
  return `host:${hostname.toLowerCase()}@${iface}`
}

function exactMac(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/-/g, ":")
  return normalized ? normalized : null
}

function naturalInterfaceKey(name: string | null): string {
  if (!name) return "~\uFFFF"
  return name.replace(/(\d+)/g, (digits) => digits.padStart(8, "0")).toLowerCase()
}

function descriptionForCoreInterface(
  coreId: string,
  interfaceName: string | null,
  coreInterfaces: readonly LocalTopologyInterfaceRow[]
): string | null {
  if (!interfaceName) return null
  const match = coreInterfaces.find(
    (iface) => iface.deviceId === coreId && iface.name.trim() === interfaceName
  )
  const description = match?.description?.trim()
  return description ? description : null
}

function richness(device: LocalTopologyObservedDevice): number {
  return (
    (device.operationalStatus ? 8 : 0) +
    (device.macAddress ? 4 : 0) +
    (device.managementIp ? 2 : 0) +
    (device.hostname ? 1 : 0) +
    (device.lastSeenAt ? 1 : 0)
  )
}

function mergeVisualDuplicates(
  devices: readonly LocalTopologyObservedDevice[],
  interfaceName: string | null
): LocalTopologyObservedDevice[] {
  const buckets = new Map<string, LocalTopologyObservedDevice[]>()
  const unmatched: LocalTopologyObservedDevice[] = []

  for (const device of devices) {
    const key = visualDedupeKey({
      macAddress: device.macAddress,
      managementIp: device.managementIp,
      hostname: device.hostname,
      interfaceName,
    })
    if (!key) {
      unmatched.push(device)
      continue
    }
    const bucket = buckets.get(key) ?? []
    bucket.push(device)
    buckets.set(key, bucket)
  }

  const merged = [...buckets.values()].map((bucket) => {
    const ranked = [...bucket].sort((left, right) => richness(right) - richness(left))
    return ranked[0]
  })

  return [...unmatched, ...merged].sort((left, right) =>
    (left.hostname ?? left.managementIp ?? "").localeCompare(
      right.hostname ?? right.managementIp ?? "",
      "es"
    )
  )
}

function toObservedDevice(
  item: NetworkDiscoveryObservationItem,
  interfaceName: string | null,
  meta:
    | {
        deviceType?: string | null
        lastSeenAt?: string | null
        agentId?: string | null
      }
    | undefined,
  status:
    | {
        status: MonitoringOperationalStatus | null
        lastPollAt: string | null
      }
    | undefined
): LocalTopologyObservedDevice {
  return {
    id: item.id,
    hostname: item.hostname,
    managementIp: item.managementIp,
    macAddress: item.macAddress,
    platform: item.platform,
    board: item.board,
    version: item.version,
    discoveredBy: item.discoveredBy,
    origin: item.origin,
    observedInterfaceName: interfaceName,
    lastSeenAt: meta?.lastSeenAt ?? null,
    deviceType: (meta?.deviceType as NetworkDeviceType | null) ?? null,
    operationalStatus: status?.status ?? null,
    lastPollAt: status?.lastPollAt ?? null,
    managed: false,
    downstream: [],
    agentId: meta?.agentId ?? null,
  }
}

export function emptyLocalCoreTopologyView(
  core: LocalCoreTopologyView["core"]
): LocalCoreTopologyView {
  return {
    core,
    jobId: null,
    interfaceGroups: [],
    cpeObservedCount: 0,
  }
}

export function attachNestedLocalTopology(
  view: LocalCoreTopologyView,
  nestedByDeviceId: ReadonlyMap<string, LocalTopologyInterfaceGroup[]>,
  managedIds: ReadonlySet<string>
): LocalCoreTopologyView {
  const claimed = new Set<string>()
  for (const groups of nestedByDeviceId.values()) {
    for (const group of groups) {
      for (const device of group.devices) claimed.add(device.id)
    }
  }

  const interfaceGroups = view.interfaceGroups.map((group) => {
    const devices = group.devices
      .filter((device) => !claimed.has(device.id) || nestedByDeviceId.has(device.id))
      .map((device) => ({
        ...device,
        managed: managedIds.has(device.id),
        downstream: nestedByDeviceId.get(device.id) ?? [],
      }))
    const cpes = group.cpes.map((device) => ({
      ...device,
      managed: managedIds.has(device.id),
      downstream: [],
    }))
    return { ...group, devices, cpes, cpeCount: cpes.length }
  })

  return {
    ...view,
    interfaceGroups,
    cpeObservedCount: interfaceGroups.reduce((sum, group) => sum + group.cpeCount, 0),
  }
}

export function buildLocalCoreTopologyView(input: {
  core: LocalCoreTopologyView["core"]
  jobId: string | null
  observations: readonly NetworkDiscoveryObservationItem[]
  links?: readonly LocalTopologyLinkRow[]
  coreInterfaces?: readonly LocalTopologyInterfaceRow[]
  deviceMeta?: ReadonlyMap<
    string,
    {
      deviceType?: string | null
      lastSeenAt?: string | null
      agentId?: string | null
    }
  >
  statusByDeviceId?: ReadonlyMap<
    string,
    {
      status: MonitoringOperationalStatus | null
      lastPollAt: string | null
    }
  >
  requireOutgoingLink?: boolean
}): LocalCoreTopologyView {
  const lanVlan: NetworkDiscoveryObservationItem[] = []

  for (const item of input.observations) {
    if (item.id === input.core.id || item.scope === "core") continue
    if (item.scope === "wan") continue
    if (item.scope === "lan" || item.scope === "vlan") {
      lanVlan.push(item)
    }
  }

  const groups = new Map<
    string,
    {
      interfaceName: string | null
      devices: LocalTopologyObservedDevice[]
      cpes: LocalTopologyObservedDevice[]
    }
  >()

  function groupFor(interfaceName: string | null) {
    const key = interfaceName ?? ""
    const existing = groups.get(key)
    if (existing) return existing
    const created = {
      interfaceName,
      devices: [] as LocalTopologyObservedDevice[],
      cpes: [] as LocalTopologyObservedDevice[],
    }
    groups.set(key, created)
    return created
  }

  for (const item of lanVlan) {
    const meta = input.deviceMeta?.get(item.id)
    const interfaceName = localObservedInterfaceName({
      coreId: input.core.id,
      deviceId: item.id,
      links: input.links ?? [],
      fallback: input.requireOutgoingLink ? null : item.observedInterfaceName,
    })
    if (input.requireOutgoingLink && !interfaceName) continue
    const device = toObservedDevice(
      item,
      interfaceName,
      meta,
      input.statusByDeviceId?.get(item.id)
    )
    const group = groupFor(interfaceName)
    if (
      isLocalTopologyInfrastructure({
        hostname: item.hostname,
        board: item.board,
        deviceType: meta?.deviceType,
      })
    ) {
      group.devices.push(device)
      continue
    }
    group.cpes.push(device)
  }

  const interfaceGroups: LocalTopologyInterfaceGroup[] = [...groups.values()]
    .map((group) => {
      const interfaceDescription = descriptionForCoreInterface(
        input.core.id,
        group.interfaceName,
        input.coreInterfaces ?? []
      )
      const devices = mergeVisualDuplicates(group.devices, group.interfaceName)
      const cpes = mergeVisualDuplicates(group.cpes, group.interfaceName)
      return {
        interfaceName: group.interfaceName,
        interfaceDescription,
        interfaceLabel:
          formatObservedInterfaceLabel(group.interfaceName, interfaceDescription) ??
          "Sin interfaz observada",
        devices,
        cpes,
        cpeCount: cpes.length,
      }
    })
    .sort((left, right) =>
      naturalInterfaceKey(left.interfaceName).localeCompare(
        naturalInterfaceKey(right.interfaceName),
        "es"
      )
    )

  return {
    core: input.core,
    jobId: input.jobId,
    interfaceGroups,
    cpeObservedCount: interfaceGroups.reduce((sum, group) => sum + group.cpeCount, 0),
  }
}
