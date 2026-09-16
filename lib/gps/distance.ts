export type GpsCoordinates = {
  latitude: number
  longitude: number
}

/**
 * Great-circle distance between two WGS84 coordinates, in meters.
 * Same formula as Field Agent task-start (R = 6_371_000). Not pixel distance.
 */
export function calculateGpsDistanceMeters(
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

export function calculatePolylineLengthMeters(
  points: ReadonlyArray<GpsCoordinates>
): number {
  if (points.length < 2) {
    return 0
  }

  let total = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    total += calculateGpsDistanceMeters(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    )
  }

  return total
}

export function roundPlannedLengthMeters(meters: number): number {
  return Math.round(meters * 100) / 100
}

export function formatPlannedLengthMeters(meters: number): string {
  return `${Math.round(meters).toLocaleString("es-AR")} m`
}

/** Cable reserve meters — keeps decimals when present (e.g. 12.5). */
export function formatGainMeters(meters: number): string {
  const rounded = roundPlannedLengthMeters(meters)
  const text =
    Math.abs(rounded - Math.round(rounded)) < 0.001
      ? Math.round(rounded).toLocaleString("es-AR")
      : rounded.toLocaleString("es-AR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
  return `${text} m`
}
