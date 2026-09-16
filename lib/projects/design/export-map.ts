import { calculateGpsDistanceMeters } from "@/lib/gps/distance"
import type { GpsCoordinates } from "@/lib/gps/types"
import { projectDesignColorToRgb } from "@/lib/projects/design/colors"
import type { ProjectDesignMapViewModel } from "@/lib/projects/design/map-view"
import type { ProjectDesignElementIcon } from "@/lib/types/project-design"

export type ProjectDesignExportMapBounds = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export type ProjectDesignExportMapProjection = {
  bounds: ProjectDesignExportMapBounds
  width: number
  height: number
  padding: number
}

const MIN_SPAN = 0.0008

export function resolveProjectDesignExportMapBounds(
  points: ReadonlyArray<GpsCoordinates>
): ProjectDesignExportMapBounds | null {
  if (points.length === 0) {
    return null
  }

  let minLat = points[0].latitude
  let maxLat = points[0].latitude
  let minLng = points[0].longitude
  let maxLng = points[0].longitude

  for (const point of points) {
    minLat = Math.min(minLat, point.latitude)
    maxLat = Math.max(maxLat, point.latitude)
    minLng = Math.min(minLng, point.longitude)
    maxLng = Math.max(maxLng, point.longitude)
  }

  const latPad = Math.max((maxLat - minLat) * 0.14, MIN_SPAN)
  const lngPad = Math.max((maxLng - minLng) * 0.14, MIN_SPAN)

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  }
}

export function projectDesignLatLngToCanvas(
  point: GpsCoordinates,
  projection: ProjectDesignExportMapProjection
): { x: number; y: number } {
  const { bounds, width, height, padding } = projection
  const usableW = Math.max(width - padding * 2, 1)
  const usableH = Math.max(height - padding * 2, 1)
  const midLat = (bounds.minLat + bounds.maxLat) / 2
  const lonScale = Math.cos((midLat * Math.PI) / 180) || 1
  const lngSpan = Math.max((bounds.maxLng - bounds.minLng) * lonScale, MIN_SPAN)
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, MIN_SPAN)
  const scale = Math.min(usableW / lngSpan, usableH / latSpan)
  const drawnW = lngSpan * scale
  const drawnH = latSpan * scale
  const offsetX = padding + (usableW - drawnW) / 2
  const offsetY = padding + (usableH - drawnH) / 2
  const x =
    offsetX + (point.longitude - bounds.minLng) * lonScale * scale
  const y = offsetY + (bounds.maxLat - point.latitude) * scale
  return { x, y }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  ctx.rect(x, y, width, height)
}

function fillRgb(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha = 1
) {
  const { r, g, b } = projectDesignColorToRgb(color)
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: ProjectDesignElementIcon,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const { r, g, b } = projectDesignColorToRgb(color)
  ctx.save()
  ctx.fillStyle = `rgb(${r},${g},${b})`
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = Math.max(1.4, size * 0.12)
  ctx.beginPath()
  if (icon === "circle") {
    ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  } else if (icon === "diamond") {
    ctx.moveTo(x, y - size / 2)
    ctx.lineTo(x + size / 2, y)
    ctx.lineTo(x, y + size / 2)
    ctx.lineTo(x - size / 2, y)
    ctx.closePath()
  } else if (icon === "hexagon") {
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 180) * (60 * i - 30)
      const px = x + (size / 2) * Math.cos(angle)
      const py = y + (size / 2) * Math.sin(angle)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
  } else if (icon === "marker") {
    ctx.moveTo(x, y + size / 2)
    ctx.bezierCurveTo(
      x + size * 0.55,
      y + size * 0.05,
      x + size * 0.45,
      y - size * 0.5,
      x,
      y - size * 0.5
    )
    ctx.bezierCurveTo(
      x - size * 0.45,
      y - size * 0.5,
      x - size * 0.55,
      y + size * 0.05,
      x,
      y + size / 2
    )
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.fillStyle = "#ffffff"
    ctx.arc(x, y - size * 0.18, size * 0.16, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  } else {
    const half = size / 2
    roundedRect(ctx, x - half, y - half, size, size, size * 0.16)
  }
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
) {
  const label = text.trim() || "—"
  ctx.save()
  ctx.font = "600 11px Helvetica, Arial, sans-serif"
  const width = ctx.measureText(label).width + 10
  const { r, g, b } = projectDesignColorToRgb(color)
  ctx.fillStyle = `rgb(${r},${g},${b})`
  ctx.beginPath()
  roundedRect(ctx, x - width / 2, y, width, 14, 3)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(label, x, y + 7)
  ctx.restore()
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  projection: ProjectDesignExportMapProjection
) {
  const { bounds } = projection
  const midLat = (bounds.minLat + bounds.maxLat) / 2
  const left = { latitude: midLat, longitude: bounds.minLng }
  const right = { latitude: midLat, longitude: bounds.maxLng }
  const widthMeters = calculateGpsDistanceMeters(
    left.latitude,
    left.longitude,
    right.latitude,
    right.longitude
  )
  if (!Number.isFinite(widthMeters) || widthMeters <= 0) {
    return
  }

  const candidates = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
  const target = widthMeters * 0.18
  const meters =
    candidates.find((value) => value >= target) ??
    candidates[candidates.length - 1]
  const ratio = meters / widthMeters
  const barWidth =
    (projection.width - projection.padding * 2) * ratio
  const x = projection.padding
  const y = projection.height - 18

  ctx.save()
  ctx.fillStyle = "#0f172a"
  ctx.fillRect(x, y, barWidth, 3)
  ctx.fillRect(x, y - 3, 1.5, 9)
  ctx.fillRect(x + barWidth, y - 3, 1.5, 9)
  ctx.font = "10px Helvetica, Arial, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText(
    meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
    x,
    y - 6
  )
  ctx.restore()
}

export function drawProjectDesignMapToCanvas(
  ctx: CanvasRenderingContext2D,
  model: ProjectDesignMapViewModel,
  width: number,
  height: number
) {
  ctx.save()
  ctx.fillStyle = "#e8eef5"
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = "#cbd5e1"
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  const padding = 28
  for (let i = 1; i < 8; i += 1) {
    ctx.strokeStyle = "#dbe4ee"
    ctx.beginPath()
    ctx.moveTo((width / 8) * i, 0)
    ctx.lineTo((width / 8) * i, height)
    ctx.moveTo(0, (height / 8) * i)
    ctx.lineTo(width, (height / 8) * i)
    ctx.stroke()
  }

  ctx.fillStyle = "#64748b"
  ctx.font = "10px Helvetica, Arial, sans-serif"
  ctx.textAlign = "right"
  ctx.fillText("N", width - 14, 16)
  ctx.beginPath()
  ctx.moveTo(width - 18, 22)
  ctx.lineTo(width - 14, 8)
  ctx.lineTo(width - 10, 22)
  ctx.closePath()
  ctx.fillStyle = "#0f172a"
  ctx.fill()

  const bounds = resolveProjectDesignExportMapBounds(model.boundsPoints)
  if (!bounds) {
    ctx.fillStyle = "#475569"
    ctx.font = "13px Helvetica, Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("Sin geometría de diseño", width / 2, height / 2)
    ctx.restore()
    return
  }

  const projection: ProjectDesignExportMapProjection = {
    bounds,
    width,
    height,
    padding,
  }

  for (const segment of model.segments) {
    if (segment.geometry.length < 2) {
      continue
    }
    const { r, g, b } = projectDesignColorToRgb(segment.color)
    ctx.beginPath()
    ctx.lineWidth = Math.max(segment.weight, 3)
    ctx.strokeStyle = `rgba(${r},${g},${b},${segment.opacity})`
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    segment.geometry.forEach((point, index) => {
      const xy = projectDesignLatLngToCanvas(point, projection)
      if (index === 0) ctx.moveTo(xy.x, xy.y)
      else ctx.lineTo(xy.x, xy.y)
    })
    ctx.stroke()
  }

  for (const gain of model.gains) {
    const xy = projectDesignLatLngToCanvas(
      { latitude: gain.latitude, longitude: gain.longitude },
      projection
    )
    ctx.save()
    ctx.translate(xy.x, xy.y)
    ctx.rotate(Math.PI / 4)
    fillRgb(ctx, gain.color)
    ctx.fillRect(-5, -5, 10, 10)
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 1.4
    ctx.strokeRect(-5, -5, 10, 10)
    ctx.restore()
    drawLabel(ctx, `${gain.gainM} m`, xy.x, xy.y + 10, gain.color)
  }

  for (const element of model.elements) {
    const xy = projectDesignLatLngToCanvas(
      { latitude: element.latitude, longitude: element.longitude },
      projection
    )
    drawIcon(ctx, element.icon, xy.x, xy.y, 14, element.color)
    drawLabel(ctx, element.name, xy.x, xy.y + 10, element.color)
  }

  drawScaleBar(ctx, projection)
  ctx.fillStyle = "#64748b"
  ctx.font = "9px Helvetica, Arial, sans-serif"
  ctx.textAlign = "right"
  ctx.fillText("WGS84 / EPSG:4326 · representación vectorial", width - 10, height - 8)
  ctx.restore()
}

export async function renderProjectDesignMapForPdf(input: {
  model: ProjectDesignMapViewModel
  widthPx?: number
  heightPx?: number
}): Promise<string | null> {
  if (typeof document === "undefined") {
    return null
  }

  const width = input.widthPx ?? 1600
  const height = input.heightPx ?? 900
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return null
  }
  ctx.scale(scale, scale)
  drawProjectDesignMapToCanvas(ctx, input.model, width, height)
  try {
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}
