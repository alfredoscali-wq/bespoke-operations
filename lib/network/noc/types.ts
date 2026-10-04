import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"

export const NOC_HEALTH_STATES = ["online", "attention", "offline"] as const

export type NocHealthState = (typeof NOC_HEALTH_STATES)[number]

export type NocTopologyNode = {
  deviceId: string
  label: string
  ipAddress: string | null
  health: NocHealthState | null
  children: NocTopologyNode[]
}

export type NocTopologyForest = {
  roots: NocTopologyNode[]
}

export type NocMonitorSummary = {
  deviceCount: number
  onlineCount: number
  attentionCount: number
  offlineCount: number
  activeAlarmCount: number
}

export type NocAlarmView = {
  id: string
  deviceId: string
  severity: string
  status: string
  title: string
  message: string
  createdAt: string
}

export type NocMonitorPage = {
  companyName: string
  summary: NocMonitorSummary
  topology: NocTopologyForest
  alarms: NocAlarmView[]
  lastUpdatedAt: string
}

export function nocHealthFromMonitoring(
  status: MonitoringOperationalStatus | null | undefined
): NocHealthState | null {
  if (status === "online") return "online"
  if (status === "offline") return "offline"
  if (status === "degraded") return "attention"
  return null
}
