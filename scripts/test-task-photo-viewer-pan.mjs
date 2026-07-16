import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  clampPhotoViewerPan,
  shouldEnablePhotoViewerPan,
} from "../lib/tasks/task-photo-viewer-pan.ts"

const root = resolve(import.meta.dirname, "..")

test("pan se desactiva en zoom 100%", () => {
  assert.equal(shouldEnablePhotoViewerPan(1), false)
  assert.equal(shouldEnablePhotoViewerPan(1.01), true)
})

test("clamp fuerza pan a 0 cuando zoom <= 1", () => {
  assert.deepEqual(
    clampPhotoViewerPan({
      x: 40,
      y: -20,
      zoom: 1,
      stageWidth: 800,
      stageHeight: 600,
    }),
    { x: 0, y: 0 }
  )
})

test("clamp limita el pan al overflow del zoom", () => {
  const result = clampPhotoViewerPan({
    x: 999,
    y: -999,
    zoom: 2,
    stageWidth: 800,
    stageHeight: 600,
  })

  // max = size * (zoom - 1) / 2
  assert.equal(result.x, 400)
  assert.equal(result.y, -300)
})

test("viewer source incluye pan + translate + drag", () => {
  const viewer = readFileSync(
    resolve(root, "components/tareas/task-photo-viewer-dialog.tsx"),
    "utf8"
  )

  assert.match(viewer, /translate\(\$\{pan\.x\}px, \$\{pan\.y\}px\) scale/)
  assert.match(viewer, /onPointerDown/)
  assert.match(viewer, /onPointerMove/)
  assert.match(viewer, /clampPhotoViewerPan/)
  assert.match(viewer, /handleDoubleClick/)
  assert.match(viewer, /addEventListener\("wheel"/)
  assert.match(viewer, /ArrowLeft/)
  assert.match(viewer, /ArrowRight/)
  assert.match(viewer, /showCloseButton/)
  assert.match(viewer, /cursor-grab/)
})
