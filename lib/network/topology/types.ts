import type { NetworkDeviceType } from "@/lib/network/constants"
import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"

export type NetworkTopologyNodeKind = "managed" | "neighbor"

export type NetworkTopologyInterface = {
  id: string
  name: string
  status: string | null
}

export type NetworkTopologyNode = {
  id: string
  hostname: string | null
  managementIp: string | null
  deviceType: NetworkDeviceType
  kind: NetworkTopologyNodeKind
  operationalStatus: MonitoringOperationalStatus | null
  lastPollAt: string | null
  interfaces: NetworkTopologyInterface[]
}

export type NetworkTopologyEdge = {
  id: string
  sourceDeviceId: string
  targetDeviceId: string
  localInterfaceName: string | null
  remoteInterfaceName: string | null
  protocol: string | null
  label: string
}

export type NetworkTopologyGraph = {
  nodes: NetworkTopologyNode[]
  edges: NetworkTopologyEdge[]
}
