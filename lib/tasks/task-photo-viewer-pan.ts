/**
 * Clamp image pan so a scaled photo can be dragged without leaving empty
 * dead zones larger than the overflow created by zoom.
 */
export function clampPhotoViewerPan(input: {
  x: number
  y: number
  zoom: number
  stageWidth: number
  stageHeight: number
}): { x: number; y: number } {
  const { x, y, zoom, stageWidth, stageHeight } = input

  if (
    zoom <= 1 ||
    !Number.isFinite(zoom) ||
    stageWidth <= 0 ||
    stageHeight <= 0
  ) {
    return { x: 0, y: 0 }
  }

  const maxX = (stageWidth * (zoom - 1)) / 2
  const maxY = (stageHeight * (zoom - 1)) / 2

  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  }
}

export function shouldEnablePhotoViewerPan(zoom: number): boolean {
  return Number.isFinite(zoom) && zoom > 1
}
