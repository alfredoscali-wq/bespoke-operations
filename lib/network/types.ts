import type {
  NetworkAgentHeartbeatStatus,
  NetworkAgentStatus,
  NetworkDeviceOrigin,
  NetworkDeviceStatus,
  NetworkDeviceType,
  NetworkJobStatus,
  NetworkJobType,
  NetworkSiteKind,
  NetworkTargetProtocol,
  NetworkVendor,
} from "@/lib/network/constants"

export type NetworkSite = {
  id: string
  companyId: string
  name: string
  kind: NetworkSiteKind
  description: string | null
  address: string | null
  locality: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
  updatedAt: string
  agentCount: number
}

export type NetworkSiteDraft = {
  name: string
  kind: NetworkSiteKind
  description?: string
  address?: string
  locality?: string
}

export type NetworkAgent = {
  id: string
  companyId: string
  siteId: string | null
  siteName: string | null
  name: string
  status: NetworkAgentStatus
  version: string | null
  hostname: string | null
  lastSeenAt: string | null
  enrolledAt: string | null
  hasEnrollmentToken: boolean
  hasCredential: boolean
  createdAt: string
  updatedAt: string
}

export type NetworkAgentDraft = {
  name: string
  siteId: string | null
}

export type NetworkAgentJob = {
  id: string
  companyId: string
  agentId: string
  agentName?: string | null
  siteId: string | null
  jobType: NetworkJobType
  status: NetworkJobStatus
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  errorMessage: string | null
  dispatchedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type NetworkAgentJobDraft = {
  jobType: NetworkJobType
  payload?: Record<string, unknown>
}

export type NetworkHomeSummary = {
  siteCount: number
  agentCount: number
  deviceCount: number
  agentsByStatus: Record<NetworkAgentStatus, number>
  pendingJobCount: number
  devicesOnline: number
  devicesOffline: number
  devicesUnknown: number
  interfacesUp: number
  interfacesDown: number
}

export type NetworkHeartbeatReport = {
  status?: NetworkAgentHeartbeatStatus
  version?: string | null
  hostname?: string | null
}

export type NetworkInterfaceAddress = {
  address: string
  prefixLength: number | null
}

export type NetworkInterface = {
  id: string
  companyId: string
  deviceId: string
  name: string
  description: string | null
  macAddress: string | null
  addresses: NetworkInterfaceAddress[]
  status: string | null
  speedMbps: number | null
  interfaceType: string | null
  lastSeenAt: string
}

export type NetworkDevice = {
  id: string
  companyId: string
  agentId: string | null
  agentName: string | null
  siteId: string | null
  siteName: string | null
  fingerprint: string
  hostname: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  deviceType: NetworkDeviceType
  managementIp: string | null
  macAddress: string | null
  firmwareVersion: string | null
  status: NetworkDeviceStatus
  origin: NetworkDeviceOrigin
  firstSeenAt: string
  lastSeenAt: string
  lastPollAt: string | null
  operationalStatus: "unknown" | "online" | "offline" | "degraded"
}

export type NetworkLink = {
  id: string
  companyId: string
  fromDeviceId: string
  fromDeviceHostname: string | null
  fromInterfaceId: string | null
  fromInterfaceName: string | null
  toDeviceId: string
  toDeviceHostname: string | null
  toInterfaceId: string | null
  toInterfaceName: string | null
  protocol: string | null
  lastSeenAt: string
}

export type NetworkDeviceDetail = NetworkDevice & {
  interfaces: NetworkInterface[]
  links: NetworkLink[]
  monitoring: NetworkDeviceMonitoring | null
}

export type NetworkDeviceMonitoring = {
  status: "unknown" | "online" | "offline" | "degraded"
  lastPollAt: string | null
  lastSuccessAt: string | null
  consecutiveFailures: number
  uptime: string | null
  cpuLoad: number | null
  memoryTotal: number | null
  memoryAvailable: number | null
  routerosVersion: string | null
  temperature: number | null
  errorCode: string | null
  errorMessage: string | null
  interfaces: NetworkInterfaceMonitoring[]
}

export type NetworkDeviceStatusHistoryEvent = {
  id: string
  previousStatus: "unknown" | "online" | "offline" | "degraded"
  newStatus: "unknown" | "online" | "offline" | "degraded"
  changedAt: string
  jobId: string | null
  consecutiveFailures: number | null
  message: string | null
  durationSeconds: number | null
}

export type NetworkDeviceStatusHistory = {
  events: NetworkDeviceStatusHistoryEvent[]
}

export type NetworkInterfaceMonitoring = {
  interfaceId: string
  interfaceName: string
  status: string | null
  speedMbps: number | null
  rxBytes: number | null
  txBytes: number | null
  rxPackets: number | null
  txPackets: number | null
  rxErrors: number | null
  txErrors: number | null
  rxDrops: number | null
  txDrops: number | null
  lastPollAt: string | null
}

export type NetworkDiscoveryTarget = {
  id: string
  companyId: string
  agentId: string
  agentName: string | null
  siteId: string | null
  siteName: string | null
  name: string
  vendor: NetworkVendor
  host: string
  port: number
  protocol: NetworkTargetProtocol
  hasSecret: boolean
  createdAt: string
  updatedAt: string
}

export type NetworkDiscoveryTargetDraft = {
  agentId: string
  siteId: string | null
  name: string
  vendor: NetworkVendor
  host: string
  port?: number
  protocol: NetworkTargetProtocol
  username: string
  password: string
}

export type NetworkDiscoveryJobView = NetworkAgentJob & {
  targetName: string | null
  targetHost: string | null
}
