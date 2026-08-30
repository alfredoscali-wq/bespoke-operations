import type { NetworkTopologyEdge } from "@/lib/network/topology/types"

export type TopologyLinkInput = {
  id: string
  fromDeviceId: string
  toDeviceId: string
  fromInterfaceName: string | null
  toInterfaceName: string | null
  protocol: string | null
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

export function mergeTopologyEdges(links: TopologyLinkInput[]): NetworkTopologyEdge[] {
  const groups = new Map<string, TopologyLinkInput[]>()
  for (const link of links) {
    if (!link.fromDeviceId || !link.toDeviceId) continue
    if (link.fromDeviceId === link.toDeviceId) continue
    const key = topologyUndirectedPairKey(link.fromDeviceId, link.toDeviceId)
    const group = groups.get(key)
    if (group) group.push(link)
    else groups.set(key, [link])
  }

  const edges: NetworkTopologyEdge[] = []
  for (const group of groups.values()) {
    const first = group[0]
    if (!first) continue
    const sourceDeviceId =
      first.fromDeviceId < first.toDeviceId ? first.fromDeviceId : first.toDeviceId
    const targetDeviceId =
      sourceDeviceId === first.fromDeviceId ? first.toDeviceId : first.fromDeviceId

    let localInterfaceName: string | null = null
    let remoteInterfaceName: string | null = null
    let protocol: string | null = null

    for (const link of group) {
      if (link.fromDeviceId === sourceDeviceId && link.fromInterfaceName) {
        localInterfaceName ??= link.fromInterfaceName
      }
      if (link.toDeviceId === sourceDeviceId && link.toInterfaceName) {
        localInterfaceName ??= link.toInterfaceName
      }
      if (link.fromDeviceId === targetDeviceId && link.fromInterfaceName) {
        remoteInterfaceName ??= link.fromInterfaceName
      }
      if (link.toDeviceId === targetDeviceId && link.toInterfaceName) {
        remoteInterfaceName ??= link.toInterfaceName
      }
      if (link.protocol) protocol ??= link.protocol
    }

    edges.push({
      id: first.id,
      sourceDeviceId,
      targetDeviceId,
      localInterfaceName,
      remoteInterfaceName,
      protocol,
      label: formatTopologyLinkLabel(localInterfaceName, remoteInterfaceName),
    })
  }

  return edges
}
