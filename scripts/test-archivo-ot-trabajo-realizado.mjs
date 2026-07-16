import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { readTrabajoRealizadoFromTask } from "../lib/tasks/trabajo-realizado.ts"

const root = resolve(import.meta.dirname, "..")

test("lee Trabajo Realizado desde task_metadata", () => {
  assert.equal(
    readTrabajoRealizadoFromTask({
      taskMetadata: { trabajoRealizado: "  Cambio de acometida.\nOK  " },
    }),
    "Cambio de acometida.\nOK"
  )
  assert.equal(
    readTrabajoRealizadoFromTask({ taskMetadata: {} }),
    null
  )
})

test("sidebar de detalle OT muestra tarjeta Trabajo Realizado bajo Cuadrilla", () => {
  const source = readFileSync(
    resolve(root, "components/tareas/task-admin-sidebar-panel.tsx"),
    "utf8"
  )

  assert.match(source, /readTrabajoRealizadoFromTask/)
  assert.match(source, /Información para la Cuadrilla/)
  assert.match(source, /Trabajo Realizado/)
  assert.match(source, /task-admin-trabajo-realizado/)
  assert.match(source, /whitespace-pre-wrap/)
  assert.match(source, /\{trabajoRealizado \? \(/)
})
