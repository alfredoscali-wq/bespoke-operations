import {
  MONITORING_OFFLINE_FAILURE_THRESHOLD,
  MONITORING_OPERATIONAL_STATUSES,
  type MonitoringOperationalStatus,
} from "@/lib/network/monitoring/contract"

export function isMonitoringOperationalStatus(
  value: unknown
): value is MonitoringOperationalStatus {
  return (
    typeof value === "string" &&
    (MONITORING_OPERATIONAL_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * A single failed poll must not mark the device offline.
 * Three consecutive failures → offline. Any success resets to online.
 */
export function nextMonitoringOperationalState(input: {
  previousStatus: MonitoringOperationalStatus
  consecutiveFailures: number
  success: boolean
}): {
  status: MonitoringOperationalStatus
  consecutiveFailures: number
} {
  const previous = isMonitoringOperationalStatus(input.previousStatus)
    ? input.previousStatus
    : "unknown"
  const priorFailures = Math.max(0, input.consecutiveFailures)

  if (input.success) {
    return { status: "online", consecutiveFailures: 0 }
  }

  const consecutiveFailures = priorFailures + 1
  if (consecutiveFailures >= MONITORING_OFFLINE_FAILURE_THRESHOLD) {
    return { status: "offline", consecutiveFailures }
  }

  return { status: previous, consecutiveFailures }
}
