import { MONITORING_POLL_INTERVAL_MS } from "@/lib/network/monitoring/contract"

export function isMonitoringDeviceDue(
  lastPollAt: string | null | undefined,
  nowMs: number,
  intervalMs: number = MONITORING_POLL_INTERVAL_MS
): boolean {
  if (!lastPollAt) return true
  const lastPollMs = new Date(lastPollAt).getTime()
  if (!Number.isFinite(lastPollMs)) return true
  return lastPollMs <= nowMs - intervalMs
}

export function pickDueMonitoringDevice<
  T extends { lastPollAt: number },
>(candidates: readonly T[]): T | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((left, right) => left.lastPollAt - right.lastPollAt)
  return sorted[0] ?? null
}
