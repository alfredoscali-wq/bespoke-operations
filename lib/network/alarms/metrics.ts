import type { NetworkAlarmRecord } from "@/lib/network/alarms/contract"

function parseTimeMs(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function diffMs(
  later: string | null | undefined,
  earlier: string | null | undefined
): number | null {
  const laterMs = parseTimeMs(later)
  const earlierMs = parseTimeMs(earlier)
  if (laterMs == null || earlierMs == null) return null
  return laterMs - earlierMs
}

/** MTTA = acknowledged_at - created_at. Does not use seen_at. */
export function networkAlarmMttaMs(
  alarm: Pick<NetworkAlarmRecord, "createdAt" | "acknowledgedAt">
): number | null {
  return diffMs(alarm.acknowledgedAt, alarm.createdAt)
}

/** MTTR = resolved_at - created_at. Does not use seen_at. */
export function networkAlarmMttrMs(
  alarm: Pick<NetworkAlarmRecord, "createdAt" | "resolvedAt">
): number | null {
  return diffMs(alarm.resolvedAt, alarm.createdAt)
}
