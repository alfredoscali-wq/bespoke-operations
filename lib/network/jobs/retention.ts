import {
  compareNetworkTimestamps,
  networkTimestampMinus,
} from "@/lib/network/discovery/latest-run"

export const NETWORK_RETENTION_CLASSES = [
  "monitoring_completed",
  "monitoring_failed",
  "discovery",
  "diagnostic",
] as const

export type NetworkRetentionClass = (typeof NETWORK_RETENTION_CLASSES)[number]

export const NETWORK_RETENTION_BATCH_LIMIT = 500
export const NETWORK_RETENTION_MAX_BATCHES = 5
export const NETWORK_RETENTION_BUDGET_MS = 40_000

const RETENTION_WINDOW_SECONDS: Record<NetworkRetentionClass, number> = {
  monitoring_completed: 24 * 60 * 60,
  monitoring_failed: 7 * 24 * 60 * 60,
  discovery: 30 * 24 * 60 * 60,
  diagnostic: 30 * 24 * 60 * 60,
}

const ACTIVE_STATUSES = new Set(["pending", "dispatched", "running"])

export type NetworkRetentionJob = {
  id: string
  companyId: string
  jobType: string
  status: string
  createdAt: string
  completedAt?: string | null
  payloadTargetId?: string | null
  resultTargetId?: string | null
  deletedAt?: string | null
}

export type NetworkRetentionClassResult = {
  retentionClass: NetworkRetentionClass
  batches: number
  jobsDeleted: number
  eventsDeleted: number
}

export type NetworkRetentionRunResult = {
  ok: boolean
  capturedAt: string
  completed: boolean
  stoppedReason: "finished" | "time_budget" | "error"
  message?: string
  results: NetworkRetentionClassResult[]
}

function cleanTargetId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null
  return trimmed
}

export function networkJobTargetKey(job: {
  payloadTargetId?: string | null
  resultTargetId?: string | null
}): string | null {
  const targetId = cleanTargetId(job.payloadTargetId) ?? cleanTargetId(job.resultTargetId)
  return targetId ? `target:${targetId}` : null
}

export function networkJobAgedAt(job: NetworkRetentionJob): string {
  const completedAt = job.completedAt?.trim()
  return completedAt ? completedAt : job.createdAt
}

function isNewerCompleted(
  candidate: NetworkRetentionJob,
  current: NetworkRetentionJob
): boolean {
  const compared = compareNetworkTimestamps(
    networkJobAgedAt(candidate),
    networkJobAgedAt(current)
  )
  if (compared !== 0) return compared > 0
  return candidate.id > current.id
}

function keepsLatestCompleted(
  job: NetworkRetentionJob,
  jobs: readonly NetworkRetentionJob[]
): boolean {
  if (job.jobType !== "discovery" && job.jobType !== "diagnostic") return false
  if (job.status !== "completed") return false
  const targetKey = networkJobTargetKey(job)
  if (!targetKey) return true
  return !jobs.some(
    (candidate) =>
      candidate.id !== job.id &&
      candidate.companyId === job.companyId &&
      candidate.jobType === job.jobType &&
      candidate.status === "completed" &&
      networkJobTargetKey(candidate) === targetKey &&
      isNewerCompleted(candidate, job)
  )
}

export function isExpiredNetworkJob(
  job: NetworkRetentionJob,
  jobs: readonly NetworkRetentionJob[],
  input: { capturedAt: string; retentionClass: NetworkRetentionClass }
): boolean {
  if (ACTIVE_STATUSES.has(job.status)) return false
  if (job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled") {
    return false
  }

  const cutoff = networkTimestampMinus(
    input.capturedAt,
    RETENTION_WINDOW_SECONDS[input.retentionClass]
  )
  if (!cutoff) return false
  if (compareNetworkTimestamps(networkJobAgedAt(job), cutoff) >= 0) return false

  if (input.retentionClass === "monitoring_completed") {
    return job.jobType === "monitoring" && job.status === "completed"
  }
  if (input.retentionClass === "monitoring_failed") {
    return (
      job.jobType === "monitoring" &&
      (job.status === "failed" || job.status === "cancelled")
    )
  }
  if (input.retentionClass === "discovery" && job.jobType !== "discovery") return false
  if (input.retentionClass === "diagnostic" && job.jobType !== "diagnostic") return false
  if (!networkJobTargetKey(job)) return false
  return !keepsLatestCompleted(job, jobs)
}

export function selectExpiredNetworkJobIds(
  jobs: readonly NetworkRetentionJob[],
  input: {
    capturedAt: string
    retentionClass: NetworkRetentionClass
    limit?: number
  }
): string[] {
  const limit = Math.min(Math.max(input.limit ?? NETWORK_RETENTION_BATCH_LIMIT, 1), 500)
  return jobs
    .filter((job) =>
      isExpiredNetworkJob(job, jobs, {
        capturedAt: input.capturedAt,
        retentionClass: input.retentionClass,
      })
    )
    .sort((left, right) => {
      const compared = compareNetworkTimestamps(networkJobAgedAt(left), networkJobAgedAt(right))
      if (compared !== 0) return compared
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    })
    .slice(0, limit)
    .map((job) => job.id)
}

export function isNetworkRetentionCronAuthorized(
  authorizationHeader: string | null,
  secret: string | null
): boolean {
  if (!secret) return false
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader ?? "")
  return match?.[1] === secret
}

export async function runNetworkJobRetention(input: {
  capturedAt: string
  purge: (
    retentionClass: NetworkRetentionClass,
    capturedAt: string
  ) => Promise<{ jobsDeleted: number; eventsDeleted: number }>
  now?: () => number
}): Promise<NetworkRetentionRunResult> {
  const startedAt = (input.now ?? Date.now)()
  const results: NetworkRetentionClassResult[] = []

  for (const retentionClass of NETWORK_RETENTION_CLASSES) {
    const result: NetworkRetentionClassResult = {
      retentionClass,
      batches: 0,
      jobsDeleted: 0,
      eventsDeleted: 0,
    }
    for (let batch = 0; batch < NETWORK_RETENTION_MAX_BATCHES; batch += 1) {
      if ((input.now ?? Date.now)() - startedAt >= NETWORK_RETENTION_BUDGET_MS) {
        if (result.batches > 0) results.push(result)
        return {
          ok: true,
          capturedAt: input.capturedAt,
          completed: false,
          stoppedReason: "time_budget",
          results,
        }
      }
      try {
        const purged = await input.purge(retentionClass, input.capturedAt)
        result.batches += 1
        result.jobsDeleted += purged.jobsDeleted
        result.eventsDeleted += purged.eventsDeleted
        if (purged.jobsDeleted === 0) break
      } catch (error) {
        if (result.batches > 0) results.push(result)
        return {
          ok: false,
          capturedAt: input.capturedAt,
          completed: false,
          stoppedReason: "error",
          message: error instanceof Error ? error.message : "La retención no pudo completar el lote.",
          results,
        }
      }
    }
    results.push(result)
  }

  return {
    ok: true,
    capturedAt: input.capturedAt,
    completed: true,
    stoppedReason: "finished",
    results,
  }
}
