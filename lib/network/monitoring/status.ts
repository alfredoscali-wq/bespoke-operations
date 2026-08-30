import { NETWORK_MONITORING_STATUS_TTL_MS } from "@/lib/network/constants"
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

function parseLastPollAtMs(lastPollAt: string | null | undefined): number | null {
  if (typeof lastPollAt !== "string" || lastPollAt.trim() === "") return null
  const parsed = Date.parse(lastPollAt)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveNowMs(now?: number | Date): number {
  if (now instanceof Date) return now.getTime()
  if (typeof now === "number" && Number.isFinite(now)) return now
  return Date.now()
}

/**
 * Display-only freshness. Does not persist unknown and does not use last_success_at.
 * Stale when last_poll_at <= now - NETWORK_MONITORING_STATUS_TTL_MS.
 */
export function displayMonitoringStatus(
  status: unknown,
  lastPollAt: string | null | undefined,
  now?: number | Date
): MonitoringOperationalStatus {
  const persisted = isMonitoringOperationalStatus(status) ? status : "unknown"
  if (persisted === "unknown") return "unknown"

  const pollMs = parseLastPollAtMs(lastPollAt)
  if (pollMs == null) return "unknown"

  const nowMs = resolveNowMs(now)
  if (pollMs <= nowMs - NETWORK_MONITORING_STATUS_TTL_MS) {
    return "unknown"
  }

  return persisted
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
