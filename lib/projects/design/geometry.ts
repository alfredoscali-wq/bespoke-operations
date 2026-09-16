import { hasCoordinates, isValidCoordinatePair, roundCoordinate } from "@/lib/gps/coordinates"
import { calculateGpsDistanceMeters } from "@/lib/gps/distance"
import type { GpsCoordinates } from "@/lib/gps/types"

export type ProjectDesignGeometryPoint = {
  latitude: number
  longitude: number
}

export function normalizeDesignGeometryPoint(
  latitude: number,
  longitude: number
): ProjectDesignGeometryPoint {
  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  }
}

export function parseDesignGeometry(
  value: unknown
): ProjectDesignGeometryPoint[] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null
  }

  const points: ProjectDesignGeometryPoint[] = []

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null
    }

    const record = item as { latitude?: unknown; longitude?: unknown }
    const latitude =
      typeof record.latitude === "number"
        ? record.latitude
        : typeof record.latitude === "string"
          ? Number(record.latitude)
          : Number.NaN
    const longitude =
      typeof record.longitude === "number"
        ? record.longitude
        : typeof record.longitude === "string"
          ? Number(record.longitude)
          : Number.NaN

    if (!isValidCoordinatePair(latitude, longitude)) {
      return null
    }

    points.push(normalizeDesignGeometryPoint(latitude, longitude))
  }

  return points
}

export function validateDesignGeometry(
  points: ReadonlyArray<GpsCoordinates>
): { ok: true; points: ProjectDesignGeometryPoint[] } | { ok: false; message: string } {
  if (points.length < 2) {
    return {
      ok: false,
      message: "El tramo necesita al menos dos puntos.",
    }
  }

  const normalized: ProjectDesignGeometryPoint[] = []
  for (const point of points) {
    if (!hasCoordinates(point.latitude, point.longitude)) {
      return {
        ok: false,
        message: "El tramo tiene coordenadas inválidas.",
      }
    }
    normalized.push(
      normalizeDesignGeometryPoint(point.latitude, point.longitude)
    )
  }

  return { ok: true, points: normalized }
}

export const DESIGN_SNAP_RADIUS_METERS = 25

const EARTH_RADIUS_METERS = 6_371_000

export type PolylineProjection = {
  latitude: number
  longitude: number
  distanceMeters: number
  distanceFromStartMeters: number
}

function toLocalMeters(
  latitude: number,
  longitude: number,
  originLatitude: number
): { x: number; y: number } {
  const cos = Math.cos((originLatitude * Math.PI) / 180)
  return {
    x: ((longitude * Math.PI) / 180) * cos * EARTH_RADIUS_METERS,
    y: ((latitude * Math.PI) / 180) * EARTH_RADIUS_METERS,
  }
}

function fromLocalMeters(
  x: number,
  y: number,
  originLatitude: number
): GpsCoordinates {
  const cos = Math.cos((originLatitude * Math.PI) / 180)
  return normalizeDesignGeometryPoint(
    (y / EARTH_RADIUS_METERS) * (180 / Math.PI),
    (x / (EARTH_RADIUS_METERS * (cos || 1))) * (180 / Math.PI)
  )
}

function projectPointOntoSegment(
  point: GpsCoordinates,
  from: GpsCoordinates,
  to: GpsCoordinates
): { latitude: number; longitude: number; distanceFromA: number } {
  const originLat = point.latitude
  const a = toLocalMeters(from.latitude, from.longitude, originLat)
  const b = toLocalMeters(to.latitude, to.longitude, originLat)
  const p = toLocalMeters(point.latitude, point.longitude, originLat)
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  const t =
    lengthSq <= 0
      ? 0
      : Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq))
  const projected = fromLocalMeters(a.x + t * abx, a.y + t * aby, originLat)
  return {
    latitude: projected.latitude,
    longitude: projected.longitude,
    distanceFromA: calculateGpsDistanceMeters(
      from.latitude,
      from.longitude,
      projected.latitude,
      projected.longitude
    ),
  }
}

export function projectPointOntoPolyline(
  point: GpsCoordinates,
  polyline: ReadonlyArray<GpsCoordinates>
): PolylineProjection | null {
  if (polyline.length < 2) {
    return null
  }

  let best: PolylineProjection | null = null
  let traveled = 0

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const from = polyline[index]
    const to = polyline[index + 1]
    const projected = projectPointOntoSegment(point, from, to)
    const distanceMeters = calculateGpsDistanceMeters(
      point.latitude,
      point.longitude,
      projected.latitude,
      projected.longitude
    )
    const distanceFromStartMeters = traveled + projected.distanceFromA
    if (!best || distanceMeters < best.distanceMeters) {
      best = {
        latitude: projected.latitude,
        longitude: projected.longitude,
        distanceMeters,
        distanceFromStartMeters,
      }
    }
    traveled += calculateGpsDistanceMeters(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    )
  }

  return best
}
