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

const ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/

function daysFromCivil(year: number, month: number, day: number): number {
  const shiftedYear = month <= 2 ? year - 1 : year
  const era = Math.floor((shiftedYear >= 0 ? shiftedYear : shiftedYear - 399) / 400)
  const yearOfEra = shiftedYear - era * 400
  const monthPrime = month + (month > 2 ? -3 : 9)
  const dayOfYear = Math.floor((153 * monthPrime + 2) / 5) + day - 1
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

function offsetToSeconds(offset: string): number | null {
  if (offset === "Z") return 0
  const sign = offset.startsWith("-") ? -1 : 1
  const digits = offset.slice(1).replace(":", "")
  if (digits.length !== 2 && digits.length !== 4) return null
  const hours = Number(digits.slice(0, 2))
  const minutes = digits.length === 4 ? Number(digits.slice(2, 4)) : 0
  if (hours > 23 || minutes > 59) return null
  return sign * (hours * 3600 + minutes * 60)
}

function timestampInstant(value: string): { seconds: number; fraction: string } | null {
  const match = ISO_TIMESTAMP.exec(value.trim())
  if (!match) return null
  const offset = offsetToSeconds(match[8] ?? "")
  if (offset == null) return null
  const days = daysFromCivil(Number(match[1]), Number(match[2]), Number(match[3]))
  const localSeconds =
    days * 86400 + Number(match[4]) * 3600 + Number(match[5]) * 60 + Number(match[6])
  return { seconds: localSeconds - offset, fraction: match[7] ?? "" }
}

function compareTimestampText(left: string, right: string): number {
  if (left === right) return 0
  return left > right ? 1 : -1
}

function compareIsoTimestamps(left: string, right: string): number {
  const leftInstant = timestampInstant(left)
  const rightInstant = timestampInstant(right)
  if (!leftInstant || !rightInstant) return compareTimestampText(left, right)
  if (leftInstant.seconds !== rightInstant.seconds) {
    return leftInstant.seconds > rightInstant.seconds ? 1 : -1
  }
  const width = Math.max(leftInstant.fraction.length, rightInstant.fraction.length)
  const leftFraction = leftInstant.fraction.padEnd(width, "0")
  const rightFraction = rightInstant.fraction.padEnd(width, "0")
  return compareTimestampText(leftFraction, rightFraction)
}

export function compareNetworkTimestamps(left: string, right: string): number {
  return compareIsoTimestamps(left, right)
}

function civilFromDays(dayCount: number): { year: number; month: number; day: number } {
  const shifted = dayCount + 719468
  const era = Math.floor((shifted >= 0 ? shifted : shifted - 146096) / 146097)
  const dayOfEra = shifted - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365
  )
  const yearBase = yearOfEra + era * 400
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1
  const month = monthPrime + (monthPrime < 10 ? 3 : -9)
  const year = yearBase + (month <= 2 ? 1 : 0)
  return { year, month, day }
}

function padded(value: number, width: number): string {
  return String(value).padStart(width, "0")
}

export function networkTimestampMinus(value: string, secondsToSubtract: number): string | null {
  const instant = timestampInstant(value)
  if (!instant || !Number.isFinite(secondsToSubtract)) return null
  const utcSeconds = instant.seconds - Math.trunc(secondsToSubtract)
  const dayCount = Math.floor(utcSeconds / 86400)
  const secondOfDay = utcSeconds - dayCount * 86400
  const { year, month, day } = civilFromDays(dayCount)
  const hour = Math.floor(secondOfDay / 3600)
  const minute = Math.floor((secondOfDay % 3600) / 60)
  const second = secondOfDay % 60
  const fraction = instant.fraction ? `.${instant.fraction}` : ""
  return `${padded(year, 4)}-${padded(month, 2)}-${padded(day, 2)}T${padded(hour, 2)}:${padded(minute, 2)}:${padded(second, 2)}${fraction}+00:00`
}

function compareDiscoveryRecency(
  left: LatestDiscoveryJobRef,
  right: LatestDiscoveryJobRef
): number {
  const byTime = compareIsoTimestamps(left.completedAt, right.completedAt)
  if (byTime !== 0) return byTime
  return compareTimestampText(left.id, right.id)
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
    compareDiscoveryRecency(job, latest) > 0 ? job : latest
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

export type DiscoveryJobLinkRef = {
  fromDeviceId: string
  toDeviceId: string
  lastSeenAt?: string | null
}

export function timestampBelongsToDiscoveryJob(
  seenAt: string | null | undefined,
  job: LatestDiscoveryJobRef
): boolean {
  const stamp = asNonEmptyString(seenAt)
  if (!stamp) return false
  const seen = Date.parse(stamp)
  const started = Date.parse(job.startedAt)
  const completed = Date.parse(job.completedAt)
  if (!Number.isFinite(seen) || !Number.isFinite(started) || !Number.isFinite(completed)) {
    return false
  }
  return seen >= started && seen <= completed
}

export function deviceIdsSeenInDiscoveryJob(
  links: readonly DiscoveryJobLinkRef[],
  job: LatestDiscoveryJobRef
): Set<string> {
  const ids = new Set<string>()
  for (const link of links) {
    if (!timestampBelongsToDiscoveryJob(link.lastSeenAt, job)) continue
    if (link.fromDeviceId) ids.add(link.fromDeviceId)
    if (link.toDeviceId) ids.add(link.toDeviceId)
  }
  return ids
}

export function filterDevicesSeenInDiscoveryJob<T extends { id: string }>(
  devices: readonly T[],
  job: LatestDiscoveryJobRef,
  links: readonly DiscoveryJobLinkRef[]
): T[] {
  const ids = deviceIdsSeenInDiscoveryJob(links, job)
  return devices.filter((device) => ids.has(device.id))
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
