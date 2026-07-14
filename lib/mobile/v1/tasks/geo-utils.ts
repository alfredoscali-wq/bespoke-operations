export const TASK_START_MAX_DISTANCE_METERS = 50

/**
 * Env kill-switch for GPS distance enforcement on mobile task start.
 * Default: disabled (allow start regardless of distance).
 * Re-enable later with: TASK_START_DISTANCE_ENFORCEMENT_ENABLED=true
 *
 * Location capture / distance logging remain active either way.
 */
export const TASK_START_DISTANCE_ENFORCEMENT_ENV =
  "TASK_START_DISTANCE_ENFORCEMENT_ENABLED"

export function isTaskStartDistanceEnforcementEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = env[TASK_START_DISTANCE_ENFORCEMENT_ENV]
  if (raw == null || String(raw).trim() === "") {
    return false
  }

  const normalized = String(raw).trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes"
}

/**
 * @deprecated Prefer isTaskStartDistanceEnforcementEnabled().
 * Kept as a documented default for tests/docs; runtime uses the env helper.
 */
export const TASK_START_DISTANCE_ENFORCEMENT_ENABLED = false

/**
 * Great-circle distance between two WGS84 coordinates, in meters.
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
  maxDistanceMeters: number = TASK_START_MAX_DISTANCE_METERS
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
 * Only blocks when enforcement is enabled AND outside radius.
 */
export function evaluateTaskStartDistancePolicy(input: {
  operatorLatitude: number
  operatorLongitude: number
  targetLatitude: number
  targetLongitude: number
  enforcementEnabled?: boolean
  maxDistanceMeters?: number
}): TaskStartDistancePolicyResult {
  const maxDistanceMeters =
    input.maxDistanceMeters ?? TASK_START_MAX_DISTANCE_METERS
  const enforcementEnabled =
    input.enforcementEnabled ?? isTaskStartDistanceEnforcementEnabled()

  const distanceToClientMeters = calculateDistanceMeters(
    input.operatorLatitude,
    input.operatorLongitude,
    input.targetLatitude,
    input.targetLongitude
  )

  const withinRadius = distanceToClientMeters <= maxDistanceMeters
  const shouldBlock = enforcementEnabled && !withinRadius

  return {
    distanceToClientMeters,
    withinRadius,
    enforcementEnabled,
    shouldBlock,
    message: shouldBlock
      ? `Se encuentra a ${Math.round(distanceToClientMeters)} metros del domicilio del cliente.`
      : null,
  }
}
