/**
 * Smoke checks for SPRINT UX 1.0 — TaskPhotoViewerDialog evidence viewer.
 * Verifies source contracts without a browser.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const viewer = read("components/tareas/task-photo-viewer-dialog.tsx")
const checklist = read("components/tareas/task-admin-operational-checklist.tsx")
const dialogUi = read("components/ui/dialog.tsx")

assert(viewer.includes("photos?: TaskPhoto[]"), "viewer accepts photos gallery")
assert(
  viewer.includes("Imagen {index + 1} de {total}"),
  "viewer shows Imagen X de N"
)
assert(viewer.includes("task-photo-viewer-prev"), "viewer has previous nav")
assert(viewer.includes("task-photo-viewer-next"), "viewer has next nav")
assert(viewer.includes("ArrowLeft"), "viewer supports keyboard prev")
assert(viewer.includes("ArrowRight"), "viewer supports keyboard next")
assert(viewer.includes("addEventListener(\"wheel\""), "viewer wheel zoom")
assert(viewer.includes("handleDoubleClick"), "viewer double-click zoom")
assert(viewer.includes("translate(${pan.x}px, ${pan.y}px) scale"), "viewer pans with translate")
assert(viewer.includes("onPointerDown"), "viewer supports drag pan")
assert(viewer.includes("object-contain"), "viewer preserves aspect ratio")
assert(viewer.includes("overlayClassName="), "viewer uses dark overlay")
assert(viewer.includes("showCloseButton"), "viewer keeps close X")
assert(viewer.includes("task-photo-viewer-zoom-in"), "viewer has zoom in control")
assert(viewer.includes("task-photo-viewer-zoom-out"), "viewer has zoom out control")
assert(
  dialogUi.includes("overlayClassName?: string"),
  "DialogContent supports overlayClassName"
)
assert(
  checklist.includes("photos={executionPhotos}"),
  "checklist wires gallery photos"
)
assert(
  checklist.includes("checklist-evidence-thumbnail"),
  "checklist keeps thumbnails"
)
assert(
  checklist.includes("setViewerOpen(true)"),
  "thumbnail click opens viewer"
)

console.log("OK: task photo viewer UX contracts")
