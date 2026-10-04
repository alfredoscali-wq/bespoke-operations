import type { NetworkAlarmRole, NetworkAlarmSeverity } from "@/lib/network/alarms/contract"

const CPE_DEVICE_TYPES = new Set(["cpe", "onu"])
const AP_DEVICE_TYPES = new Set(["ap", "radio"])
const AGGREGATION_DEVICE_TYPES = new Set(["switch", "olt"])

export type NetworkAlarmRoleInput = {
  isManaged: boolean
  deviceType?: string | null
  managedAncestorCount: number
}

/**
 * Alarmas 1.0: role from managed flag + device_type only.
 * Does not use names, network_links, or Discovery ancestry.
 * `managedAncestorCount` is ignored (legacy input from sync).
 *
 * Ambiguous managed types (`router`, `other`, empty) cannot distinguish
 * Core vs PowerBox vs AP without ancestry; they map to aggregation.
 */
export function classifyNetworkAlarmRole(
  input: NetworkAlarmRoleInput
): NetworkAlarmRole {
  if (!input.isManaged) return "cpe"

  const deviceType = (input.deviceType ?? "").trim().toLowerCase()
  if (CPE_DEVICE_TYPES.has(deviceType)) return "cpe"
  if (AP_DEVICE_TYPES.has(deviceType)) return "ap"
  if (deviceType === "core") return "core"
  if (AGGREGATION_DEVICE_TYPES.has(deviceType)) return "aggregation"

  return "aggregation"
}

export function severityForNetworkAlarmRole(
  role: NetworkAlarmRole
): NetworkAlarmSeverity | null {
  if (role === "cpe") return null
  if (role === "ap") return "warning"
  return "critical"
}
