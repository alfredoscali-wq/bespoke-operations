import type { NetworkDeviceType } from "@/lib/network/constants"
import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"
import type {
  NetworkTopologyEdge,
  NetworkTopologyGraph,
  NetworkTopologyInterface,
  NetworkTopologyNode,
  NetworkTopologyNodeKind,
} from "@/lib/network/topology/types"

export type TopologyLinkInput = {
  id: string
  fromDeviceId: string
  toDeviceId: string
  fromInterfaceName: string | null
  toInterfaceName: string | null
  protocol: string | null
}

type CanonicalLink = {
  id: string
  deviceLo: string
  deviceHi: string
  ifaceLo: string | null
  ifaceHi: string | null
  ifaceLoDisplay: string | null
  ifaceHiDisplay: string | null
  protocols: string[]
}

type Cluster = {
  id: string
  deviceLo: string
  deviceHi: string
  ifaceLo: string | null
  ifaceHi: string | null
  ifaceLoDisplay: string | null
  ifaceHiDisplay: string | null
  protocols: string[]
}

export type TopologySelection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }

export function resolveTopologySelection(
  selection: TopologySelection | null,
  nodes: ReadonlyArray<{ id: string }>,
  edges: ReadonlyArray<{ id: string }>
): TopologySelection | null {
  if (!selection) return null
  if (selection.kind === "node") {
    return nodes.some((node) => node.id === selection.id) ? selection : null
  }
  return edges.some((edge) => edge.id === selection.id) ? selection : null
}

export function topologyUndirectedPairKey(left: string, right: string): string {
  return left < right ? `${left}::${right}` : `${right}::${left}`
}

export function formatTopologyLinkLabel(
  localInterfaceName: string | null | undefined,
  remoteInterfaceName: string | null | undefined
): string {
  const local = localInterfaceName?.trim() || null
  const remote = remoteInterfaceName?.trim() || null
  if (local && remote) return `${local} ↔ ${remote}`
  return local ?? remote ?? "—"
}

export function formatTopologyNodeIdentity(
  hostname: string | null | undefined,
  managementIp: string | null | undefined
): string {
  const name = hostname?.trim() || null
  const ip = managementIp?.trim() || null
  if (name && ip) return `${name} · ${ip}`
  return name ?? ip ?? "vecino"
}

export function formatTopologyPeerLink(input: {
  selectedDeviceId: string
  edge: NetworkTopologyEdge
  peerHostname: string | null | undefined
  peerManagementIp: string | null | undefined
}): string {
  const selectedIsSource = input.selectedDeviceId === input.edge.sourceDeviceId
  const localIface = (
    selectedIsSource ? input.edge.localInterfaceName : input.edge.remoteInterfaceName
  )?.trim() || "—"
  const identity = formatTopologyNodeIdentity(
    input.peerHostname,
    input.peerManagementIp
  )
  const protocol = input.edge.protocol?.trim()
  return protocol ? `${localIface} → ${identity} · ${protocol}` : `${localIface} → ${identity}`
}

export function formatTopologyProtocols(
  protocol: string | null | undefined
): string {
  const protocols = parseProtocols(protocol)
  if (protocols.length === 0) return "—"
  return protocols.map((item) => item.toUpperCase()).join(" · ")
}

export function topologyManagedDeviceHref(node: {
  id: string
  kind: NetworkTopologyNodeKind
}): string | null {
  if (node.kind !== "managed") return null
  return `/network/devices/${node.id}`
}

export type TopologyEdgeEndpointDetail = {
  deviceId: string | null
  identity: string
  hostname: string | null
  managementIp: string | null
  interfaceName: string | null
  kind: NetworkTopologyNodeKind | null
  operationalStatus: MonitoringOperationalStatus | null
  lastPollAt: string | null
  monitored: boolean
  deviceHref: string | null
}

export type TopologyEdgeDetail = {
  edgeId: string
  localInterfaceName: string | null
  remoteInterfaceName: string | null
  interfacesLabel: string
  protocolsLabel: string
  protocol: string | null
  endpointA: TopologyEdgeEndpointDetail
  endpointB: TopologyEdgeEndpointDetail
}

function toEdgeEndpoint(
  node: NetworkTopologyNode | null | undefined,
  interfaceName: string | null
): TopologyEdgeEndpointDetail {
  const iface = interfaceName?.trim() || null
  if (!node) {
    return {
      deviceId: null,
      identity: "vecino",
      hostname: null,
      managementIp: null,
      interfaceName: iface,
      kind: null,
      operationalStatus: null,
      lastPollAt: null,
      monitored: false,
      deviceHref: null,
    }
  }
  const monitored = node.kind === "managed"
  return {
    deviceId: node.id,
    identity: formatTopologyNodeIdentity(node.hostname, node.managementIp),
    hostname: node.hostname,
    managementIp: node.managementIp,
    interfaceName: iface,
    kind: node.kind,
    operationalStatus: monitored ? node.operationalStatus : null,
    lastPollAt: monitored ? node.lastPollAt : null,
    monitored,
    deviceHref: topologyManagedDeviceHref(node),
  }
}

export function buildTopologyEdgeDetail(
  edge: NetworkTopologyEdge,
  nodesById: Map<string, NetworkTopologyNode>
): TopologyEdgeDetail {
  return {
    edgeId: edge.id,
    localInterfaceName: edge.localInterfaceName,
    remoteInterfaceName: edge.remoteInterfaceName,
    interfacesLabel: formatTopologyLinkLabel(
      edge.localInterfaceName,
      edge.remoteInterfaceName
    ),
    protocolsLabel: formatTopologyProtocols(edge.protocol),
    protocol: edge.protocol,
    endpointA: toEdgeEndpoint(
      nodesById.get(edge.sourceDeviceId),
      edge.localInterfaceName
    ),
    endpointB: toEdgeEndpoint(
      nodesById.get(edge.targetDeviceId),
      edge.remoteInterfaceName
    ),
  }
}

export function uniqueTopologyInterfaces(
  interfaces: NetworkTopologyInterface[]
): NetworkTopologyInterface[] {
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const unique: NetworkTopologyInterface[] = []
  for (const iface of interfaces) {
    if (iface.id) {
      if (seenIds.has(iface.id)) continue
      seenIds.add(iface.id)
    }
    const nameKey = iface.name.trim().toLowerCase()
    if (nameKey && seenNames.has(nameKey)) continue
    if (nameKey) seenNames.add(nameKey)
    unique.push(iface)
  }
  return unique
}

function trimInterface(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function parseProtocols(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  const seen = new Set<string>()
  const protocols: string[] = []
  for (const part of value.split(/[,;/|]+/)) {
    const protocol = part.trim().toLowerCase()
    if (!protocol || seen.has(protocol)) continue
    seen.add(protocol)
    protocols.push(protocol)
  }
  return protocols
}

function combineProtocols(lists: string[][]): string | null {
  const seen = new Set<string>()
  const protocols: string[] = []
  for (const list of lists) {
    for (const protocol of list) {
      if (seen.has(protocol)) continue
      seen.add(protocol)
      protocols.push(protocol)
    }
  }
  protocols.sort((left, right) => left.localeCompare(right))
  return protocols.length > 0 ? protocols.join(",") : null
}

function sidesCompatible(left: string | null, right: string | null): boolean {
  if (left == null || right == null) return true
  return left === right
}

function toCanonical(link: TopologyLinkInput): CanonicalLink | null {
  if (!link.fromDeviceId || !link.toDeviceId) return null
  if (link.fromDeviceId === link.toDeviceId) return null
  const deviceLo =
    link.fromDeviceId < link.toDeviceId ? link.fromDeviceId : link.toDeviceId
  const deviceHi =
    deviceLo === link.fromDeviceId ? link.toDeviceId : link.fromDeviceId
  const fromIsLo = link.fromDeviceId === deviceLo
  const fromIface = trimInterface(link.fromInterfaceName)
  const toIface = trimInterface(link.toInterfaceName)
  const ifaceLoDisplay = fromIsLo ? fromIface : toIface
  const ifaceHiDisplay = fromIsLo ? toIface : fromIface
  return {
    id: link.id,
    deviceLo,
    deviceHi,
    ifaceLo: ifaceLoDisplay?.toLowerCase() ?? null,
    ifaceHi: ifaceHiDisplay?.toLowerCase() ?? null,
    ifaceLoDisplay,
    ifaceHiDisplay,
    protocols: parseProtocols(link.protocol),
  }
}

function knownSides(link: CanonicalLink): number {
  return (link.ifaceLo ? 1 : 0) + (link.ifaceHi ? 1 : 0)
}

function canJoin(cluster: Cluster, link: CanonicalLink): boolean {
  return (
    sidesCompatible(cluster.ifaceLo, link.ifaceLo) &&
    sidesCompatible(cluster.ifaceHi, link.ifaceHi)
  )
}

function absorb(cluster: Cluster, link: CanonicalLink) {
  if (!cluster.ifaceLo && link.ifaceLo) {
    cluster.ifaceLo = link.ifaceLo
    cluster.ifaceLoDisplay = link.ifaceLoDisplay
  }
  if (!cluster.ifaceHi && link.ifaceHi) {
    cluster.ifaceHi = link.ifaceHi
    cluster.ifaceHiDisplay = link.ifaceHiDisplay
  }
  cluster.protocols.push(...link.protocols)
}

export function mergeTopologyEdges(links: TopologyLinkInput[]): NetworkTopologyEdge[] {
  const byPair = new Map<string, CanonicalLink[]>()
  for (const link of links) {
    const canonical = toCanonical(link)
    if (!canonical) continue
    const key = `${canonical.deviceLo}::${canonical.deviceHi}`
    const group = byPair.get(key)
    if (group) group.push(canonical)
    else byPair.set(key, [canonical])
  }

  const edges: NetworkTopologyEdge[] = []
  for (const group of byPair.values()) {
    group.sort((left, right) => knownSides(right) - knownSides(left))
    const clusters: Cluster[] = []
    for (const link of group) {
      const match = clusters.find((cluster) => canJoin(cluster, link))
      if (match) {
        absorb(match, link)
        continue
      }
      clusters.push({
        id: link.id,
        deviceLo: link.deviceLo,
        deviceHi: link.deviceHi,
        ifaceLo: link.ifaceLo,
        ifaceHi: link.ifaceHi,
        ifaceLoDisplay: link.ifaceLoDisplay,
        ifaceHiDisplay: link.ifaceHiDisplay,
        protocols: [...link.protocols],
      })
    }

    for (const cluster of clusters) {
      edges.push({
        id: cluster.id,
        sourceDeviceId: cluster.deviceLo,
        targetDeviceId: cluster.deviceHi,
        localInterfaceName: cluster.ifaceLoDisplay,
        remoteInterfaceName: cluster.ifaceHiDisplay,
        protocol: combineProtocols([cluster.protocols]),
        label: formatTopologyLinkLabel(
          cluster.ifaceLoDisplay,
          cluster.ifaceHiDisplay
        ),
      })
    }
  }

  return edges
}

export type TopologyGraphDeviceInput = {
  id: string
  companyId: string
  agentId: string | null
  siteId: string | null
  hostname: string | null
  managementIp: string | null
  deviceType: NetworkDeviceType
  origin: string | null
  kind: NetworkTopologyNodeKind
  operationalStatus: MonitoringOperationalStatus | null
  lastPollAt: string | null
  interfaces: NetworkTopologyInterface[]
}

export function topologyCanonicalIdentityKey(device: {
  companyId: string
  agentId: string | null
  siteId: string | null
  hostname: string | null
}): string | null {
  const hostname = device.hostname?.trim().toLowerCase() ?? ""
  const agentId = device.agentId?.trim() ?? ""
  if (!hostname || !agentId) return null
  return `${device.companyId.trim()}\0${agentId}\0${device.siteId?.trim() ?? ""}\0${hostname}`
}

export function resolveTopologyDeviceAliases(
  devices: TopologyGraphDeviceInput[]
): Map<string, string> {
  const managedByKey = new Map<string, string>()
  for (const device of devices) {
    if (device.kind !== "managed") continue
    const key = topologyCanonicalIdentityKey(device)
    if (!key || managedByKey.has(key)) continue
    managedByKey.set(key, device.id)
  }

  const aliases = new Map<string, string>()
  for (const device of devices) {
    if (
      device.kind !== "managed" &&
      (device.origin ?? "").trim().toLowerCase() === "neighbor"
    ) {
      const key = topologyCanonicalIdentityKey(device)
      const managedId = key ? managedByKey.get(key) : undefined
      if (managedId) {
        aliases.set(device.id, managedId)
        continue
      }
    }
    aliases.set(device.id, device.id)
  }
  return aliases
}

function toTopologyNode(device: TopologyGraphDeviceInput): NetworkTopologyNode {
  return {
    id: device.id,
    hostname: device.hostname,
    managementIp: device.managementIp,
    deviceType: device.deviceType,
    kind: device.kind,
    operationalStatus: device.operationalStatus,
    lastPollAt: device.lastPollAt ?? null,
    interfaces: device.interfaces,
  }
}

export function buildCanonicalTopologyGraph(
  devices: TopologyGraphDeviceInput[],
  links: TopologyLinkInput[]
): NetworkTopologyGraph {
  const aliases = resolveTopologyDeviceAliases(devices)
  const nodes = devices
    .filter((device) => aliases.get(device.id) === device.id)
    .map(toTopologyNode)

  const remapped = links.map((link) => ({
    ...link,
    fromDeviceId: aliases.get(link.fromDeviceId) ?? link.fromDeviceId,
    toDeviceId: aliases.get(link.toDeviceId) ?? link.toDeviceId,
  }))

  return {
    nodes,
    edges: mergeTopologyEdges(remapped),
  }
}
