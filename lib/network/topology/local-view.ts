import type { NetworkDeviceType } from "@/lib/network/constants"
import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"
import type { NetworkDiscoveryObservationItem } from "@/lib/network/discovery/observations"

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
}

export type LocalTopologyInterfaceGroup = {
  interfaceName: string | null
  devices: LocalTopologyObservedDevice[]
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
  wanObservedCount: number
  unknownExcludedCount: number
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

const CPE_TYPE = new Set(["cpe", "onu"])
const CPE_TOKEN = /\b(hap|cpe|onu)\b/
const INFRA_IDENTITY = /^(as\s*\d+|powerbox)\b/i
const INFRA_BOARD = /\b(crs|ccr|css|netpower|powerbox|netmetal)\b|\brb\d/

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

export function isLikelyCustomerCpe(input: {
  deviceType?: string | null
  board?: string | null
  hostname?: string | null
}): boolean {
  if (isNamedLanInfrastructure(input)) return false
  const type = input.deviceType?.trim().toLowerCase() ?? ""
  if (CPE_TYPE.has(type)) return true
  const haystack = `${input.board ?? ""} ${input.hostname ?? ""}`.toLowerCase()
  return CPE_TOKEN.test(haystack)
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

function naturalInterfaceKey(name: string | null): string {
  if (!name) return "~\uFFFF"
  return name.replace(/(\d+)/g, (digits) => digits.padStart(8, "0")).toLowerCase()
}

export function emptyLocalCoreTopologyView(
  core: LocalCoreTopologyView["core"]
): LocalCoreTopologyView {
  return {
    core,
    jobId: null,
    interfaceGroups: [],
    cpeObservedCount: 0,
    wanObservedCount: 0,
    unknownExcludedCount: 0,
  }
}

export function buildLocalCoreTopologyView(input: {
  core: LocalCoreTopologyView["core"]
  jobId: string | null
  observations: readonly NetworkDiscoveryObservationItem[]
  links?: readonly LocalTopologyLinkRow[]
  deviceMeta?: ReadonlyMap<
    string,
    {
      deviceType?: string | null
      lastSeenAt?: string | null
    }
  >
  statusByDeviceId?: ReadonlyMap<
    string,
    {
      status: MonitoringOperationalStatus | null
      lastPollAt: string | null
    }
  >
}): LocalCoreTopologyView {
  let wanObservedCount = 0
  let unknownExcludedCount = 0
  const lanVlan: NetworkDiscoveryObservationItem[] = []

  for (const item of input.observations) {
    if (item.id === input.core.id || item.scope === "core") continue
    if (item.scope === "wan") {
      wanObservedCount += 1
      continue
    }
    if (item.scope === "lan" || item.scope === "vlan") {
      lanVlan.push(item)
      continue
    }
    unknownExcludedCount += 1
  }

  const groups = new Map<string, LocalTopologyInterfaceGroup>()

  function groupFor(interfaceName: string | null): LocalTopologyInterfaceGroup {
    const key = interfaceName ?? ""
    const existing = groups.get(key)
    if (existing) return existing
    const created: LocalTopologyInterfaceGroup = {
      interfaceName,
      devices: [],
      cpeCount: 0,
    }
    groups.set(key, created)
    return created
  }

  let cpeObservedCount = 0
  for (const item of lanVlan) {
    const meta = input.deviceMeta?.get(item.id)
    const interfaceName = localObservedInterfaceName({
      coreId: input.core.id,
      deviceId: item.id,
      links: input.links ?? [],
      fallback: item.observedInterfaceName,
    })
    const cpe = isLikelyCustomerCpe({
      deviceType: meta?.deviceType,
      board: item.board,
      hostname: item.hostname,
    })
    const group = groupFor(interfaceName)
    if (cpe) {
      group.cpeCount += 1
      cpeObservedCount += 1
      continue
    }
    const status = input.statusByDeviceId?.get(item.id)
    group.devices.push({
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
    })
  }

  const interfaceGroups = [...groups.values()].sort((left, right) =>
    naturalInterfaceKey(left.interfaceName).localeCompare(
      naturalInterfaceKey(right.interfaceName),
      "es"
    )
  )
  for (const group of interfaceGroups) {
    group.devices.sort((left, right) =>
      (left.hostname ?? left.managementIp ?? "").localeCompare(
        right.hostname ?? right.managementIp ?? "",
        "es"
      )
    )
  }

  return {
    core: input.core,
    jobId: input.jobId,
    interfaceGroups,
    cpeObservedCount,
    wanObservedCount,
    unknownExcludedCount,
  }
}
