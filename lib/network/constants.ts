export const NETWORK_SITE_KINDS = [
  "pop",
  "node",
  "tower",
  "datacenter",
  "office",
  "other",
] as const

export type NetworkSiteKind = (typeof NETWORK_SITE_KINDS)[number]

export const NETWORK_AGENT_STATUSES = [
  "pending",
  "online",
  "degraded",
  "offline",
  "maintenance",
] as const

export type NetworkAgentStatus = (typeof NETWORK_AGENT_STATUSES)[number]

export const NETWORK_AGENT_HEARTBEAT_STATUSES = [
  "online",
  "degraded",
  "offline",
  "maintenance",
] as const

export type NetworkAgentHeartbeatStatus =
  (typeof NETWORK_AGENT_HEARTBEAT_STATUSES)[number]

export const NETWORK_JOB_TYPES = [
  "discovery",
  "monitoring",
  "backup",
  "diagnostic",
  "command",
  "verification",
] as const

export type NetworkJobType = (typeof NETWORK_JOB_TYPES)[number]

export const NETWORK_JOB_STATUSES = [
  "pending",
  "dispatched",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const

export type NetworkJobStatus = (typeof NETWORK_JOB_STATUSES)[number]

export const NETWORK_DEVICE_TYPES = [
  "core",
  "router",
  "switch",
  "ap",
  "radio",
  "olt",
  "onu",
  "cpe",
  "other",
] as const

export type NetworkDeviceType = (typeof NETWORK_DEVICE_TYPES)[number]

export const NETWORK_DEVICE_STATUSES = [
  "unknown",
  "online",
  "offline",
  "degraded",
  "maintenance",
] as const

export type NetworkDeviceStatus = (typeof NETWORK_DEVICE_STATUSES)[number]

export const NETWORK_DEVICE_ORIGINS = ["discovery", "neighbor"] as const

export type NetworkDeviceOrigin = (typeof NETWORK_DEVICE_ORIGINS)[number]

export const NETWORK_VENDORS = [
  "mikrotik",
  "ubiquiti",
  "zte",
  "huawei",
  "vsol",
] as const

export type NetworkVendor = (typeof NETWORK_VENDORS)[number]

export const NETWORK_TARGET_PROTOCOLS = ["api", "rest"] as const

export type NetworkTargetProtocol = (typeof NETWORK_TARGET_PROTOCOLS)[number]

export const NETWORK_ACTIVITY_MODULE = "network" as const
export const NETWORK_ACTIVITY_ENTITY_AGENT = "network_agent" as const
export const NETWORK_ACTIVITY_ENTITY_DEVICE = "network_device" as const
export const NETWORK_ACTIVITY_ENTITY_JOB = "network_agent_job" as const

export const NETWORK_ENROLLMENT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const NETWORK_ENROLLMENT_TOKEN_PREFIX = "bne_" as const
export const NETWORK_AGENT_TOKEN_PREFIX = "bna_" as const

export const NETWORK_MONITORING_POLL_INTERVAL_MS = 60_000
export const NETWORK_MONITORING_OFFLINE_FAILURES = 3

export const NETWORK_JOB_DISPATCHED_STALE_MS = 2 * 60 * 1000
export const NETWORK_JOB_RUNNING_STALE_MS = 10 * 60 * 1000

export const NETWORK_JOB_STALE_DISPATCHED_ERROR =
  "Job abandonado después del claim"
export const NETWORK_JOB_STALE_RUNNING_ERROR =
  "Job abandonado durante la ejecución"
