export const TASK_START_MAX_DISTANCE_METERS = 50

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
