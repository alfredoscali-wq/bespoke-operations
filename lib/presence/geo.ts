/**
 * Presence Engine — distance helpers (server authority).
 * Kept inside the engine to avoid coupling Presence → Mobile.
 */

const EARTH_RADIUS_METERS = 6_371_000

export function calculatePresenceDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
): number {
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

  return EARTH_RADIUS_METERS * c
}
