import { roundCoordinate } from "@/lib/gps/coordinates"
import type { GpsCoordinates } from "@/lib/gps/types"
import { findSnapTarget } from "@/lib/projects/design/snap"
import type {
  ProjectDesignElement,
  ProjectDesignTool,
} from "@/lib/types/project-design"

export function isDesignDrawTool(tool: ProjectDesignTool): boolean {
  return tool === "draw-segment"
}

export function isDesignPlacementTool(tool: ProjectDesignTool): boolean {
  return tool === "add-node" || tool === "add-nap"
}

export function isDesignGainTool(tool: ProjectDesignTool): boolean {
  return tool === "add-gain"
}

export function shouldSelectDesignElement(tool: ProjectDesignTool): boolean {
  return tool === "select"
}

export function shouldSelectDesignSegment(tool: ProjectDesignTool): boolean {
  return tool === "select"
}

export function shouldSelectDesignGain(tool: ProjectDesignTool): boolean {
  return tool === "select"
}

export function cancelDesignDrawing(): {
  drawingPoints: GpsCoordinates[]
  drawingOriginElementId: string | null
} {
  return {
    drawingPoints: [],
    drawingOriginElementId: null,
  }
}

function toPoint(latitude: number, longitude: number): GpsCoordinates {
  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  }
}

function samePoint(left: GpsCoordinates, right: GpsCoordinates): boolean {
  return left.latitude === right.latitude && left.longitude === right.longitude
}

function appendPoint(
  points: GpsCoordinates[],
  point: GpsCoordinates
): GpsCoordinates[] {
  const last = points[points.length - 1]
  if (last && samePoint(last, point)) {
    return points
  }
  return [...points, point]
}

function snapEndpoint(
  geometry: GpsCoordinates[],
  index: number,
  elementId: string | null,
  elements: Pick<ProjectDesignElement, "id" | "latitude" | "longitude">[]
): GpsCoordinates[] {
  if (!elementId) {
    return geometry
  }
  const element = elements.find((item) => item.id === elementId)
  if (!element) {
    return geometry
  }
  const next = geometry.map((point) => ({ ...point }))
  next[index] = toPoint(element.latitude, element.longitude)
  return next
}

export type DrawingInteractionResult =
  | {
      action: "add-vertex"
      drawingPoints: GpsCoordinates[]
      originElementId: string | null
    }
  | {
      action: "finish"
      geometry: GpsCoordinates[]
      originElementId: string | null
      destinationElementId: string | null
    }
  | { action: "ignore" }

export function resolveDrawingElementClick(input: {
  element: Pick<ProjectDesignElement, "id" | "latitude" | "longitude">
  drawingPoints: GpsCoordinates[]
  originElementId: string | null
  elements: Pick<ProjectDesignElement, "id" | "latitude" | "longitude">[]
}): DrawingInteractionResult {
  const point = toPoint(input.element.latitude, input.element.longitude)

  if (input.drawingPoints.length === 0) {
    return {
      action: "add-vertex",
      drawingPoints: [point],
      originElementId: input.element.id,
    }
  }

  const originElementId =
    input.originElementId ??
    findSnapTarget(input.drawingPoints[0], input.elements)?.id ??
    null

  const geometry = snapEndpoint(
    appendPoint(input.drawingPoints, point),
    0,
    originElementId,
    input.elements
  )

  if (geometry.length < 2) {
    return { action: "ignore" }
  }

  return {
    action: "finish",
    geometry: snapEndpoint(
      geometry,
      geometry.length - 1,
      input.element.id,
      input.elements
    ),
    originElementId,
    destinationElementId: input.element.id,
  }
}

export function resolveDrawingMapClick(input: {
  click: GpsCoordinates
  drawingPoints: GpsCoordinates[]
  originElementId: string | null
  elements: Pick<ProjectDesignElement, "id" | "latitude" | "longitude">[]
}): DrawingInteractionResult {
  const snap = findSnapTarget(input.click, input.elements)
  if (snap) {
    return resolveDrawingElementClick({
      element: snap,
      drawingPoints: input.drawingPoints,
      originElementId: input.originElementId,
      elements: input.elements,
    })
  }

  return {
    action: "add-vertex",
    drawingPoints: appendPoint(
      input.drawingPoints,
      toPoint(input.click.latitude, input.click.longitude)
    ),
    originElementId: input.originElementId,
  }
}

export function resolveDrawingFinish(input: {
  drawingPoints: GpsCoordinates[]
  originElementId: string | null
  elements: Pick<ProjectDesignElement, "id" | "latitude" | "longitude">[]
}): DrawingInteractionResult {
  if (input.drawingPoints.length < 2) {
    return { action: "ignore" }
  }

  const first = input.drawingPoints[0]
  const last = input.drawingPoints[input.drawingPoints.length - 1]
  const originElementId =
    input.originElementId ?? findSnapTarget(first, input.elements)?.id ?? null
  const destinationElementId =
    findSnapTarget(last, input.elements)?.id ?? null

  let geometry = input.drawingPoints.map((point) => ({ ...point }))
  geometry = snapEndpoint(geometry, 0, originElementId, input.elements)
  geometry = snapEndpoint(
    geometry,
    geometry.length - 1,
    destinationElementId,
    input.elements
  )

  return {
    action: "finish",
    geometry,
    originElementId,
    destinationElementId,
  }
}
