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
