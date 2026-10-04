export const NETWORK_ALARM_SEVERITIES = ["critical", "warning"] as const

export type NetworkAlarmSeverity = (typeof NETWORK_ALARM_SEVERITIES)[number]

export const NETWORK_ALARM_STATUSES = ["open", "acknowledged", "resolved"] as const

export type NetworkAlarmStatus = (typeof NETWORK_ALARM_STATUSES)[number]

export const NETWORK_ALARM_ROLES = ["core", "aggregation", "ap", "cpe"] as const

export type NetworkAlarmRole = (typeof NETWORK_ALARM_ROLES)[number]

export const NETWORK_ALARM_ACTIVE_STATUSES = ["open", "acknowledged"] as const

export type NetworkAlarmActiveStatus = (typeof NETWORK_ALARM_ACTIVE_STATUSES)[number]

export const NETWORK_ALARM_AUTO_RESOLVE_NOTE =
  "Recuperación automática de monitoring."

export type NetworkAlarmRecord = {
  id: string
  companyId: string
  deviceId: string
  severity: NetworkAlarmSeverity
  status: NetworkAlarmStatus
  title: string
  message: string
  rootAlarmId: string | null
  isRoot: boolean
  createdAt: string
  seenAt: string | null
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionNote: string | null
}

export type NetworkAlarmDto = NetworkAlarmRecord & {
  mttaMs: number | null
  mttrMs: number | null
}

export function isNetworkAlarmSeverity(
  value: unknown
): value is NetworkAlarmSeverity {
  return (
    typeof value === "string" &&
    (NETWORK_ALARM_SEVERITIES as readonly string[]).includes(value)
  )
}

export function isNetworkAlarmStatus(value: unknown): value is NetworkAlarmStatus {
  return (
    typeof value === "string" &&
    (NETWORK_ALARM_STATUSES as readonly string[]).includes(value)
  )
}

export function isNetworkAlarmRole(value: unknown): value is NetworkAlarmRole {
  return (
    typeof value === "string" &&
    (NETWORK_ALARM_ROLES as readonly string[]).includes(value)
  )
}

export function isActiveNetworkAlarmStatus(
  value: unknown
): value is NetworkAlarmActiveStatus {
  return (
    typeof value === "string" &&
    (NETWORK_ALARM_ACTIVE_STATUSES as readonly string[]).includes(value)
  )
}

export function networkAlarmTitleForRole(role: NetworkAlarmRole): string {
  if (role === "core") return "Core offline"
  if (role === "aggregation") return "Agregación offline"
  if (role === "ap") return "AP offline"
  return "Dispositivo offline"
}

export function networkAlarmMessageForRole(
  role: NetworkAlarmRole,
  identity: string | null | undefined
): string {
  const label = identity?.trim() || "Dispositivo"
  if (role === "core") return `${label} (core) pasó a offline.`
  if (role === "aggregation") return `${label} (agregación) pasó a offline.`
  if (role === "ap") return `${label} (AP) pasó a offline.`
  return `${label} pasó a offline.`
}
