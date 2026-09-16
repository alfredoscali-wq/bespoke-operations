import { resolveElementColor, resolveSegmentColor } from "@/lib/projects/design/colors"
import { parseDesignGeometry } from "@/lib/projects/design/geometry"
import { resolveElementIcon } from "@/lib/projects/design/icons"
import { resolveProjectDesignSegmentLabel } from "@/lib/projects/design/summary"
import type { MobileProjectDesignMapDto } from "@/lib/mobile/v1/projects/types"
import type { ProjectDesignSnapshot } from "@/lib/types/project-design"

export function computeMobileProjectDesignBoundingBox(
  points: ReadonlyArray<{ latitude: number; longitude: number }>
): MobileProjectDesignMapDto["boundingBox"] {
  if (points.length === 0) {
    return null
  }

  let south = points[0].latitude
  let north = points[0].latitude
  let west = points[0].longitude
  let east = points[0].longitude

  for (const point of points) {
    south = Math.min(south, point.latitude)
    north = Math.max(north, point.latitude)
    west = Math.min(west, point.longitude)
    east = Math.max(east, point.longitude)
  }

  return { south, west, north, east }
}

export function resolveMobileProjectDesignVersion(
  snapshot: ProjectDesignSnapshot
): { designVersion: number; updatedAt: string | null } {
  const timestamps = [
    ...snapshot.elements.map((item) => item.updatedAt),
    ...snapshot.segments.map((item) => item.updatedAt),
    ...snapshot.gains.map((item) => item.updatedAt),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  if (timestamps.length === 0) {
    return { designVersion: 0, updatedAt: null }
  }

  let latest = timestamps[0]
  let latestMs = Date.parse(latest)
  for (const value of timestamps) {
    const ms = Date.parse(value)
    if (Number.isFinite(ms) && (!Number.isFinite(latestMs) || ms > latestMs)) {
      latest = value
      latestMs = ms
    }
  }

  return {
    designVersion: Number.isFinite(latestMs) ? latestMs : 0,
    updatedAt: Number.isFinite(latestMs) ? latest : null,
  }
}

export function mapMobileProjectDesignMap(input: {
  projectId: string
  projectName: string
  snapshot: ProjectDesignSnapshot
}): MobileProjectDesignMapDto {
  const elements = input.snapshot.elements
    .filter((element) => element.kind === "node" || element.kind === "nap")
    .map((element) => ({
      id: element.id,
      kind: element.kind,
      identifier: element.name.trim() || element.id,
      latitude: element.latitude,
      longitude: element.longitude,
      icon: resolveElementIcon(element.kind, element.icon),
      color: resolveElementColor(element.kind, element.color),
    }))

  const segments = input.snapshot.segments.map((segment) => ({
    id: segment.id,
    label: resolveProjectDesignSegmentLabel(segment, input.snapshot.elements),
    type: segment.type,
    color: resolveSegmentColor(segment.color),
    cableReference: segment.cableReference.trim(),
    coordinates: parseDesignGeometry(segment.geometry) ?? [],
    plannedLengthM: segment.plannedLengthM,
    originElementId: segment.originElementId,
    destinationElementId: segment.destinationElementId,
    notes: segment.notes.trim(),
  }))

  const segmentIds = new Set(segments.map((segment) => segment.id))
  const gains = input.snapshot.gains
    .filter((gain) => segmentIds.has(gain.segmentId))
    .map((gain) => ({
      id: gain.id,
      segmentId: gain.segmentId,
      latitude: gain.latitude,
      longitude: gain.longitude,
      gainM: gain.gainM,
    }))

  const points = [
    ...elements.map((element) => ({
      latitude: element.latitude,
      longitude: element.longitude,
    })),
    ...segments.flatMap((segment) => segment.coordinates),
    ...gains.map((gain) => ({
      latitude: gain.latitude,
      longitude: gain.longitude,
    })),
  ]
  const version = resolveMobileProjectDesignVersion(input.snapshot)

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    designVersion: version.designVersion,
    updatedAt: version.updatedAt,
    boundingBox: computeMobileProjectDesignBoundingBox(points),
    segments,
    elements,
    gains,
  }
}
