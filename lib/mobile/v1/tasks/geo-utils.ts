/**
 * Great-circle distance between two WGS84 coordinates, in meters.
 * OT start radius comes from the authenticated tenant (`taskRadiusMeters`).
 * Never from a global constant or env. Distinct from Presence Engine
 * operational geofence radius — see `DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS`
 * in `lib/presence`. Do not reuse this helper for presence ENTER/EXIT validation.
 */
export function calculateDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
): number {
  const earthRadiusMeters = 6_371_000
  const toRadians = (value: number) => (value * Math.PI) / 180

  const latDelta = toRadians(toLatitude - fromLatitude)
  const lonDelta = toRadians(toLongitude - fromLongitude)
  const fromLat = toRadians(fromLatitude)
  const toLat = toRadians(toLatitude)

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

export function isWithinTaskStartRadius(
  operatorLatitude: number,
  operatorLongitude: number,
  taskLatitude: number,
  taskLongitude: number,
  maxDistanceMeters: number
): boolean {
  return (
    calculateDistanceMeters(
      operatorLatitude,
      operatorLongitude,
      taskLatitude,
      taskLongitude
    ) <= maxDistanceMeters
  )
}

export type TaskStartDistancePolicyResult = {
  distanceToClientMeters: number
  withinRadius: boolean
  enforcementEnabled: boolean
  shouldBlock: boolean
  message: string | null
}

/**
 * Evaluates GPS distance for task start without mutating state.
 * Always computes distance (for logging / task_execution_starts).
 * Only blocks when tenant enforcement is enabled AND outside the tenant radius.
 * Caller must pass tenant GPS settings — no env / global fallback.
 */
export function evaluateTaskStartDistancePolicy(input: {
  operatorLatitude: number
  operatorLongitude: number
  targetLatitude: number
  targetLongitude: number
  enforcementEnabled: boolean
  maxDistanceMeters: number
}): TaskStartDistancePolicyResult {
  const distanceToClientMeters = calculateDistanceMeters(
    input.operatorLatitude,
    input.operatorLongitude,
    input.targetLatitude,
    input.targetLongitude
  )

  const withinRadius = distanceToClientMeters <= input.maxDistanceMeters
  const shouldBlock = input.enforcementEnabled && !withinRadius

  return {
    distanceToClientMeters,
    withinRadius,
    enforcementEnabled: input.enforcementEnabled,
    shouldBlock,
    message: shouldBlock
      ? `Se encuentra a ${Math.round(distanceToClientMeters)} metros del domicilio del cliente.`
      : null,
  }
}
