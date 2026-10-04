import type {
  NetworkDeviceType,
  NetworkJobStatus,
  NetworkJobType,
} from "@/lib/network/constants"
import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"
import type {
  LocalCoreTopologyView,
  LocalTopologyCoreOption,
} from "@/lib/network/topology/local-view"

export type {
  LocalCoreTopologyView,
  LocalTopologyCoreOption,
  LocalTopologyInterfaceGroup,
  LocalTopologyObservedDevice,
} from "@/lib/network/topology/local-view"

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
  origin: string | null
  agentId: string | null
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

export type NetworkTopologyManagementJob = {
  id: string
  jobType: NetworkJobType
  status: NetworkJobStatus
  targetId: string | null
  targetHost: string | null
  deviceId: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export type NetworkTopologyManagementTarget = {
  agentId: string
  host: string
  updatedAt: string
  hasSecret: boolean
}

export type CuratedTopologyNode = {
  deviceId: string
  label: string
  hostname: string | null
  ipAddress: string | null
  status: MonitoringOperationalStatus | null
  children: CuratedTopologyNode[]
}

export type CuratedTopologyForest = {
  roots: CuratedTopologyNode[]
}

export type NetworkTopologyPage = {
  graph: NetworkTopologyGraph
  cores: LocalTopologyCoreOption[]
  local: LocalCoreTopologyView | null
  curated: CuratedTopologyForest | null
  discoveryJobs: NetworkTopologyManagementJob[]
  managementTargets: NetworkTopologyManagementTarget[]
}
