import { hasCoordinates } from "@/lib/gps/coordinates"
import {
  formatGainMeters,
  roundPlannedLengthMeters,
} from "@/lib/gps/distance"
import type { GpsCoordinates } from "@/lib/gps/types"
import {
  DESIGN_SNAP_RADIUS_METERS,
  projectPointOntoPolyline,
} from "@/lib/projects/design/geometry"
import { resolveProjectDesignSegmentLabel } from "@/lib/projects/design/summary"
import type {
  ProjectDesignElement,
  ProjectDesignGain,
  ProjectDesignSegment,
} from "@/lib/types/project-design"

export const DEFAULT_TRACE_GAIN_M = 10

export type ProjectDesignGainPlacement = {
  segmentId: string
  latitude: number
  longitude: number
  distanceFromStartMeters: number
  distanceMeters: number
}

export function parseProjectDesignGainMeters(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null
    }
    return roundPlannedLengthMeters(value)
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().replace(",", ".")
  if (trimmed === "") {
    return 0
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return roundPlannedLengthMeters(parsed)
}

export function resolveGainPlacement(input: {
  click: GpsCoordinates
  segments: Array<
    Pick<ProjectDesignSegment, "id"> & {
      geometry: ReadonlyArray<GpsCoordinates>
    }
  >
  radiusMeters?: number
}): ProjectDesignGainPlacement | null {
  if (!hasCoordinates(input.click.latitude, input.click.longitude)) {
    return null
  }

  const radius = input.radiusMeters ?? DESIGN_SNAP_RADIUS_METERS
  let best: ProjectDesignGainPlacement | null = null

  for (const segment of input.segments) {
    const projected = projectPointOntoPolyline(input.click, segment.geometry)
    if (!projected || projected.distanceMeters > radius) {
      continue
    }
    if (!best || projected.distanceMeters < best.distanceMeters) {
      best = {
        segmentId: segment.id,
        latitude: projected.latitude,
        longitude: projected.longitude,
        distanceFromStartMeters: projected.distanceFromStartMeters,
        distanceMeters: projected.distanceMeters,
      }
    }
  }

  return best
}

export function distanceFromStartForGain(
  gain: Pick<ProjectDesignGain, "latitude" | "longitude">,
  segment: Pick<ProjectDesignSegment, "geometry"> | null | undefined
): number | null {
  if (!segment) {
    return null
  }
  const projected = projectPointOntoPolyline(
    { latitude: gain.latitude, longitude: gain.longitude },
    segment.geometry
  )
  return projected ? roundPlannedLengthMeters(projected.distanceFromStartMeters) : null
}

export function formatProjectDesignGainListLabel(
  gain: Pick<ProjectDesignGain, "gainM" | "segmentId">,
  segments: Pick<
    ProjectDesignSegment,
    "id" | "name" | "originElementId" | "destinationElementId"
  >[],
  elements: Pick<ProjectDesignElement, "id" | "name">[]
): string {
  const segment = segments.find((item) => item.id === gain.segmentId)
  const trace = segment
    ? resolveProjectDesignSegmentLabel(segment, elements)
    : "Tramo"
  return `Ganancia ${formatGainMeters(gain.gainM)} · ${trace}`
}

export function filterGainsAfterSegmentDelete(
  gains: Pick<ProjectDesignGain, "segmentId">[],
  segmentId: string
): Pick<ProjectDesignGain, "segmentId">[] {
  return gains.filter((gain) => gain.segmentId !== segmentId)
}

export function projectDesignGainMarkerHtml(input: {
  gainM: number
  color: string
  selected?: boolean
  labeled?: boolean
}): string {
  const size = input.selected ? 10 : 8
  const ring = input.selected
    ? `box-shadow:0 0 0 3px ${input.color}66;`
    : "box-shadow:0 1px 2px rgba(15,23,42,.35);"
  const showLabel = Boolean(input.labeled || input.selected)
  const label = showLabel
    ? `<span style="margin-top:2px;border-radius:3px;background:${input.color};padding:0 4px;font-size:9px;font-weight:700;line-height:14px;color:#fff">${escapeHtml(formatGainMeters(input.gainM))}</span>`
    : ""
  return `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <span style="display:block;height:${size}px;width:${size}px;transform:rotate(45deg);border:1.5px solid #fff;background:${input.color};${ring}"></span>
      ${label}
    </div>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
