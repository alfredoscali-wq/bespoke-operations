import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  SELECTED_LOCATION_MAP_ZOOM,
} from "@/lib/gps/constants"
import { hasCoordinates } from "@/lib/gps/coordinates"
import { formatGainMeters } from "@/lib/gps/distance"
import type { GpsCoordinates } from "@/lib/gps/types"
import { resolveElementColor, resolveSegmentColor } from "@/lib/projects/design/colors"
import { parseDesignGeometry } from "@/lib/projects/design/geometry"
import { resolveElementIcon } from "@/lib/projects/design/icons"
import { formatProjectDesignKindLabel } from "@/lib/projects/design/labels"
import { formatProjectDesignSegmentListLabel } from "@/lib/projects/design/summary"
import type {
  ProjectDesignElement,
  ProjectDesignElementIcon,
  ProjectDesignElementKind,
  ProjectDesignGain,
  ProjectDesignMapHighlight,
  ProjectDesignSegment,
  ProjectDesignSnapshot,
} from "@/lib/types/project-design"

export const PROJECT_DESIGN_MAP_VIEW_POLYLINE = {
  context: { weight: 4, opacity: 0.82 },
  highlight: { weight: 6, opacity: 0.95 },
} as const

export type ProjectDesignMapHighlightIds = {
  elementIds: string[]
  segmentIds: string[]
}

export type ProjectDesignMapViewFrame = {
  center: GpsCoordinates
  zoom: number
  hasProjectGps: boolean
}

export type ProjectDesignMapViewElementRender = {
  id: string
  kind: ProjectDesignElementKind
  name: string
  latitude: number
  longitude: number
  color: string
  icon: ProjectDesignElementIcon
  highlighted: boolean
  tooltip: string
}

export type ProjectDesignMapViewSegmentRender = {
  id: string
  name: string
  geometry: GpsCoordinates[]
  color: string
  highlighted: boolean
  weight: number
  opacity: number
  tooltip: string
}

export type ProjectDesignMapViewGainRender = {
  id: string
  segmentId: string
  latitude: number
  longitude: number
  gainM: number
  color: string
  labeled: true
  highlighted: boolean
  tooltip: string
}

export type ProjectDesignMapViewModel = {
  frame: ProjectDesignMapViewFrame
  elements: ProjectDesignMapViewElementRender[]
  segments: ProjectDesignMapViewSegmentRender[]
  gains: ProjectDesignMapViewGainRender[]
  boundsPoints: GpsCoordinates[]
  hasRenderableFeatures: boolean
  highlight: ProjectDesignMapHighlightIds
}

function uniqueNonEmptyIds(
  values: ReadonlyArray<string | null | undefined>
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const id = typeof value === "string" ? value.trim() : ""
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
  }
  return result
}

export function normalizeProjectDesignMapHighlight(
  highlight?: ProjectDesignMapHighlight | null
): ProjectDesignMapHighlightIds {
  if (!highlight) {
    return { elementIds: [], segmentIds: [] }
  }

  const collected = uniqueNonEmptyIds([
    highlight.id,
    ...(highlight.ids ?? []),
  ])

  if (highlight.kind === "element") {
    return { elementIds: collected, segmentIds: [] }
  }

  return { elementIds: [], segmentIds: collected }
}

export function isProjectDesignElementHighlighted(
  elementId: string,
  highlight?: ProjectDesignMapHighlight | null
): boolean {
  const ids = normalizeProjectDesignMapHighlight(highlight).elementIds
  return ids.includes(elementId)
}

export function isProjectDesignSegmentHighlighted(
  segmentId: string,
  highlight?: ProjectDesignMapHighlight | null
): boolean {
  const ids = normalizeProjectDesignMapHighlight(highlight).segmentIds
  return ids.includes(segmentId)
}

export function parseProjectDesignMapHighlightKey(
  value: string
): ProjectDesignMapHighlight | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const separator = trimmed.indexOf(":")
  if (separator <= 0) {
    return null
  }

  const kind = trimmed.slice(0, separator)
  const id = trimmed.slice(separator + 1).trim()
  if (kind !== "element" && kind !== "segment") {
    return null
  }
  if (!id) {
    return null
  }

  return { kind, id }
}

export function resolveProjectDesignMapViewFrame(input: {
  projectLatitude?: number | null
  projectLongitude?: number | null
}): ProjectDesignMapViewFrame {
  const hasProjectGps = hasCoordinates(
    input.projectLatitude,
    input.projectLongitude
  )
  if (hasProjectGps) {
    return {
      center: {
        latitude: input.projectLatitude as number,
        longitude: input.projectLongitude as number,
      },
      zoom: SELECTED_LOCATION_MAP_ZOOM,
      hasProjectGps: true,
    }
  }

  return {
    center: {
      latitude: DEFAULT_MAP_CENTER.latitude,
      longitude: DEFAULT_MAP_CENTER.longitude,
    },
    zoom: DEFAULT_MAP_ZOOM,
    hasProjectGps: false,
  }
}

export function emptyProjectDesignSnapshot(): ProjectDesignSnapshot {
  return { elements: [], segments: [], gains: [] }
}

function snapshotOrEmpty(
  snapshot?: ProjectDesignSnapshot | null
): ProjectDesignSnapshot {
  if (!snapshot) {
    return emptyProjectDesignSnapshot()
  }
  return {
    elements: snapshot.elements ?? [],
    segments: snapshot.segments ?? [],
    gains: snapshot.gains ?? [],
  }
}

function elementTooltip(
  element: Pick<ProjectDesignElement, "kind" | "name" | "gainM">
): string {
  const kind = formatProjectDesignKindLabel(element.kind)
  const name = element.name.trim() || kind
  if (element.gainM > 0) {
    return `${kind} · ${name} · ${formatGainMeters(element.gainM)}`
  }
  return `${kind} · ${name}`
}

function segmentTooltip(
  segment: Pick<
    ProjectDesignSegment,
    "name" | "originElementId" | "destinationElementId" | "plannedLengthM"
  >,
  elements: Pick<ProjectDesignElement, "id" | "name">[]
): string {
  return formatProjectDesignSegmentListLabel(segment, elements)
}

function gainTooltip(
  gain: Pick<ProjectDesignGain, "gainM">
): string {
  return `Ganancia ${formatGainMeters(gain.gainM)}`
}

export function collectProjectDesignMapViewPoints(
  snapshot?: ProjectDesignSnapshot | null
): GpsCoordinates[] {
  const data = snapshotOrEmpty(snapshot)
  const points: GpsCoordinates[] = []

  for (const element of data.elements) {
    if (hasCoordinates(element.latitude, element.longitude)) {
      points.push({
        latitude: element.latitude,
        longitude: element.longitude,
      })
    }
  }

  for (const segment of data.segments) {
    const geometry = parseDesignGeometry(segment.geometry)
    if (!geometry) {
      continue
    }
    for (const point of geometry) {
      points.push(point)
    }
  }

  for (const gain of data.gains) {
    if (hasCoordinates(gain.latitude, gain.longitude)) {
      points.push({
        latitude: gain.latitude,
        longitude: gain.longitude,
      })
    }
  }

  return points
}

export function buildProjectDesignMapViewModel(input: {
  snapshot?: ProjectDesignSnapshot | null
  projectLatitude?: number | null
  projectLongitude?: number | null
  highlight?: ProjectDesignMapHighlight | null
}): ProjectDesignMapViewModel {
  const snapshot = snapshotOrEmpty(input.snapshot)
  const highlight = normalizeProjectDesignMapHighlight(input.highlight)
  const highlightedElements = new Set(highlight.elementIds)
  const highlightedSegments = new Set(highlight.segmentIds)

  const elements: ProjectDesignMapViewElementRender[] = []
  for (const element of snapshot.elements) {
    if (!hasCoordinates(element.latitude, element.longitude)) {
      continue
    }
    const highlighted = highlightedElements.has(element.id)
    elements.push({
      id: element.id,
      kind: element.kind,
      name: element.name,
      latitude: element.latitude,
      longitude: element.longitude,
      color: resolveElementColor(element.kind, element.color),
      icon: resolveElementIcon(element.kind, element.icon),
      highlighted,
      tooltip: elementTooltip(element),
    })
  }

  const segments: ProjectDesignMapViewSegmentRender[] = []
  for (const segment of snapshot.segments) {
    const geometry = parseDesignGeometry(segment.geometry)
    if (!geometry) {
      continue
    }
    const highlighted = highlightedSegments.has(segment.id)
    const style = highlighted
      ? PROJECT_DESIGN_MAP_VIEW_POLYLINE.highlight
      : PROJECT_DESIGN_MAP_VIEW_POLYLINE.context
    segments.push({
      id: segment.id,
      name: segment.name,
      geometry,
      color: resolveSegmentColor(segment.color),
      highlighted,
      weight: style.weight,
      opacity: style.opacity,
      tooltip: segmentTooltip(segment, snapshot.elements),
    })
  }

  segments.sort((left, right) => Number(left.highlighted) - Number(right.highlighted))

  const gains: ProjectDesignMapViewGainRender[] = []
  for (const gain of snapshot.gains) {
    if (!hasCoordinates(gain.latitude, gain.longitude)) {
      continue
    }
    const parent = snapshot.segments.find((item) => item.id === gain.segmentId)
    const highlighted = highlightedSegments.has(gain.segmentId)
    gains.push({
      id: gain.id,
      segmentId: gain.segmentId,
      latitude: gain.latitude,
      longitude: gain.longitude,
      gainM: gain.gainM,
      color: resolveSegmentColor(parent?.color),
      labeled: true,
      highlighted,
      tooltip: gainTooltip(gain),
    })
  }

  const boundsPoints = collectProjectDesignMapViewPoints(snapshot)

  return {
    frame: resolveProjectDesignMapViewFrame({
      projectLatitude: input.projectLatitude,
      projectLongitude: input.projectLongitude,
    }),
    elements,
    segments,
    gains,
    boundsPoints,
    hasRenderableFeatures: boundsPoints.length > 0,
    highlight,
  }
}
