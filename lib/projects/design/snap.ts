import { calculateGpsDistanceMeters } from "@/lib/gps/distance"
import type { GpsCoordinates } from "@/lib/gps/types"
import { DESIGN_SNAP_RADIUS_METERS } from "@/lib/projects/design/geometry"
import type { ProjectDesignElement } from "@/lib/types/project-design"

export type ProjectDesignSnapTarget = Pick<
  ProjectDesignElement,
  "id" | "latitude" | "longitude"
>

export function findSnapTarget(
  point: GpsCoordinates,
  elements: ProjectDesignSnapTarget[],
  radiusMeters: number = DESIGN_SNAP_RADIUS_METERS
): ProjectDesignSnapTarget | null {
  let nearest: ProjectDesignSnapTarget | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const element of elements) {
    const distance = calculateGpsDistanceMeters(
      point.latitude,
      point.longitude,
      element.latitude,
      element.longitude
    )
    if (distance <= radiusMeters && distance < nearestDistance) {
      nearestDistance = distance
      nearest = element
    }
  }

  return nearest
}

export function findNearestProjectDesignElement(
  point: GpsCoordinates,
  elements: ProjectDesignSnapTarget[],
  radiusMeters: number = DESIGN_SNAP_RADIUS_METERS
): string | null {
  return findSnapTarget(point, elements, radiusMeters)?.id ?? null
}

export function associateSegmentEndpoints(input: {
  geometry: GpsCoordinates[]
  elements: Pick<ProjectDesignElement, "id" | "latitude" | "longitude">[]
}): {
  originElementId: string | null
  destinationElementId: string | null
} {
  const first = input.geometry[0]
  const last = input.geometry[input.geometry.length - 1]
  if (!first || !last) {
    return { originElementId: null, destinationElementId: null }
  }

  return {
    originElementId: findNearestProjectDesignElement(first, input.elements),
    destinationElementId: findNearestProjectDesignElement(last, input.elements),
  }
}
