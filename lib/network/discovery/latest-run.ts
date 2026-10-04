import {
  emptyNetworkDiscoveryObservationView,
  type NetworkDiscoveryObservationView,
} from "@/lib/network/discovery/observations"

export type LatestDiscoveryJobRef = {
  id: string
  agentId: string
  startedAt: string
  completedAt: string
  targetId: string | null
  targetName: string | null
  targetHost: string | null
}

export type NetworkDiscoveryLatestObservationView =
  NetworkDiscoveryObservationView & {
    jobId: string | null
    targetId: string | null
    targetName: string | null
    targetHost: string | null
  }

type DiscoveryJobLike = {
  id: string
  status: string
  agentId: string
  createdAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  payload?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
  targetName?: string | null
  targetHost?: string | null
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function emptyNetworkDiscoveryLatestObservationView(): NetworkDiscoveryLatestObservationView {
  return {
    ...emptyNetworkDiscoveryObservationView(),
    jobId: null,
    targetId: null,
    targetName: null,
    targetHost: null,
  }
}

export function withLatestDiscoveryJobMeta(
  view: NetworkDiscoveryObservationView,
  job: LatestDiscoveryJobRef | null
): NetworkDiscoveryLatestObservationView {
  return {
    ...view,
    jobId: job?.id ?? null,
    targetId: job?.targetId ?? null,
    targetName: job?.targetName ?? null,
    targetHost: job?.targetHost ?? null,
  }
}

export function pickLatestCompletedDiscoveryJob(
  jobs: readonly DiscoveryJobLike[]
): LatestDiscoveryJobRef | null {
  const completed = jobs.flatMap((job) => {
    if (job.status !== "completed") return []
    const startedAt = asNonEmptyString(job.startedAt)
    const completedAt = asNonEmptyString(job.completedAt)
    if (!startedAt || !completedAt) return []
    const payload = job.payload ?? {}
    const result = job.result ?? {}
    return [
      {
        id: job.id,
        agentId: job.agentId,
        startedAt,
        completedAt,
        targetId:
          asNonEmptyString(payload.targetId) ??
          asNonEmptyString(result.targetId),
        targetName:
          asNonEmptyString(job.targetName) ??
          asNonEmptyString(payload.targetName),
        targetHost:
          asNonEmptyString(job.targetHost) ?? asNonEmptyString(payload.host),
      } satisfies LatestDiscoveryJobRef,
    ]
  })

  if (completed.length === 0) return null
  return completed.reduce((latest, job) =>
    Date.parse(job.completedAt) > Date.parse(latest.completedAt) ? job : latest
  )
}

export function pickLatestCompletedDiscoveryJobForHost(
  jobs: readonly DiscoveryJobLike[],
  host: string | null | undefined
): LatestDiscoveryJobRef | null {
  const expected = asNonEmptyString(host)
  if (!expected) return null
  const matching = jobs.filter((job) => {
    const payload = job.payload ?? {}
    const result = job.result ?? {}
    const jobHost =
      asNonEmptyString(job.targetHost) ??
      asNonEmptyString(payload.host) ??
      asNonEmptyString(result.primaryManagementIp)
    return jobHost === expected
  })
  return pickLatestCompletedDiscoveryJob(matching)
}

export function discoveryJobTargetId(
  job: DiscoveryJobLike
): string | null {
  const payload = job.payload ?? {}
  const result = job.result ?? {}
  return asNonEmptyString(payload.targetId) ?? asNonEmptyString(result.targetId)
}

function discoveryJobTimelineMs(job: DiscoveryJobLike): number {
  const stamp =
    asNonEmptyString(job.completedAt) ??
    asNonEmptyString(job.startedAt) ??
    asNonEmptyString(job.createdAt)
  const parsed = stamp ? Date.parse(stamp) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}

export function sortDiscoveryJobsNewestFirst<T extends DiscoveryJobLike>(
  jobs: readonly T[]
): T[] {
  return [...jobs].sort(
    (left, right) => discoveryJobTimelineMs(right) - discoveryJobTimelineMs(left)
  )
}

export function filterDiscoveryJobsForTarget<T extends DiscoveryJobLike>(
  jobs: readonly T[],
  targetId: string | null | undefined
): T[] {
  const expected = asNonEmptyString(targetId)
  if (!expected) return []
  return jobs.filter((job) => discoveryJobTargetId(job) === expected)
}

export function discoveryJobsForTargetNewestFirst<T extends DiscoveryJobLike>(
  jobs: readonly T[],
  targetId: string | null | undefined
): T[] {
  return sortDiscoveryJobsNewestFirst(
    filterDiscoveryJobsForTarget(jobs, targetId)
  )
}

export function pickLatestCompletedDiscoveryJobForTarget(
  jobs: readonly DiscoveryJobLike[],
  targetId: string | null | undefined
): LatestDiscoveryJobRef | null {
  return pickLatestCompletedDiscoveryJob(
    filterDiscoveryJobsForTarget(jobs, targetId)
  )
}

export function initialDiscoveryTargetId(
  targets: readonly { id: string }[],
  currentId: string | null | undefined
): string {
  const current = asNonEmptyString(currentId)
  if (current && targets.some((target) => target.id === current)) {
    return current
  }
  return asNonEmptyString(targets[0]?.id) ?? ""
}

export function deviceWasSeenInDiscoveryJob(
  device: { agentId: string | null; lastSeenAt?: string | null },
  job: LatestDiscoveryJobRef
): boolean {
  if (!device.agentId || device.agentId !== job.agentId) return false
  const seenAt = asNonEmptyString(device.lastSeenAt)
  if (!seenAt) return false
  const seen = Date.parse(seenAt)
  const started = Date.parse(job.startedAt)
  const completed = Date.parse(job.completedAt)
  if (!Number.isFinite(seen) || !Number.isFinite(started) || !Number.isFinite(completed)) {
    return false
  }
  return seen >= started && seen <= completed
}

export function filterDevicesSeenInDiscoveryJob<
  T extends { agentId: string | null; lastSeenAt?: string | null },
>(devices: readonly T[], job: LatestDiscoveryJobRef): T[] {
  return devices.filter((device) => deviceWasSeenInDiscoveryJob(device, job))
}

export function nextDiscoveryObservationState(
  current: {
    latest: NetworkDiscoveryLatestObservationView | null
    historical: NetworkDiscoveryObservationView | null
  },
  body: {
    latestObservations?: NetworkDiscoveryLatestObservationView | null
    historicalObservations?: NetworkDiscoveryObservationView | null
  }
): {
  latest: NetworkDiscoveryLatestObservationView | null
  historical: NetworkDiscoveryObservationView | null
} {
  return {
    latest:
      body.latestObservations != null
        ? body.latestObservations
        : current.latest,
    historical:
      body.historicalObservations != null
        ? body.historicalObservations
        : current.historical,
  }
}
