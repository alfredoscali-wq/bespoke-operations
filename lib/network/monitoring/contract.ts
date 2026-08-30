import type { NetworkVendor } from "@/lib/network/constants"

export const MONITORING_EXECUTABLE_JOB_TYPE = "monitoring" as const

export const MONITORING_POLL_INTERVAL_MS = 60_000

export const MONITORING_OFFLINE_FAILURE_THRESHOLD = 3

export const MONITORING_OPERATIONAL_STATUSES = [
  "unknown",
  "online",
  "offline",
  "degraded",
] as const

export type MonitoringOperationalStatus =
  (typeof MONITORING_OPERATIONAL_STATUSES)[number]

export type MonitoringInterfaceCounters = {
  name: string
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
}

export type MonitoringSnapshot = {
  vendor: NetworkVendor
  deviceId: string
  targetId: string
  host: string
  hostname: string | null
  routerosVersion: string | null
  uptime: string | null
  cpuLoad: number | null
  memoryTotal: number | null
  memoryAvailable: number | null
  temperature: number | null
  interfaces: MonitoringInterfaceCounters[]
  warnings: string[]
}

export type MonitoringJobPayload = {
  deviceId: string
  targetId: string
  host: string
}
