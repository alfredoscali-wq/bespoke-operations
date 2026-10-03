import type { NetworkJobStatus } from "@/lib/network/constants"

export const NETWORK_DISCOVERY_JOB_POLL_MS = 2_000

const INFLIGHT_STATUSES = new Set<NetworkJobStatus>([
  "pending",
  "dispatched",
  "running",
])

export function isNetworkDiscoveryJobInflight(
  status: string | null | undefined
): boolean {
  return status != null && INFLIGHT_STATUSES.has(status as NetworkJobStatus)
}

export function hasNetworkDiscoveryJobInflight(
  jobs: readonly { status: string }[]
): boolean {
  return jobs.some((job) => isNetworkDiscoveryJobInflight(job.status))
}

export function targetHasNetworkDiscoveryJobInflight(
  jobs: readonly { status: string; payload?: Record<string, unknown> | null }[],
  targetId: string
): boolean {
  return jobs.some(
    (job) =>
      isNetworkDiscoveryJobInflight(job.status) &&
      typeof job.payload?.targetId === "string" &&
      job.payload.targetId === targetId
  )
}
