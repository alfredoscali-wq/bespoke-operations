/**
 * Sprint Mobile UX + GPS OT Obra 1.0
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  formatOperationalDateRangeLabel,
  resolveObraAgendaLegend,
} from "../lib/mobile/v1/agenda/operational-date-display.ts"
import {
  buildTaskStartLocationRequiredMessage,
  resolveTaskStartCoordinatesFromSources,
} from "../lib/mobile/v1/tasks/task-start-coordinates.ts"

const root = resolve(import.meta.dirname, "..")
const LAT = -34.6
const LNG = -58.4
const OBRA_LAT = 25.6866
const OBRA_LNG = -100.3161

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("UX: OT un día muestra una sola fecha", () => {
  assert.equal(
    formatOperationalDateRangeLabel("2026-08-10", "2026-08-10"),
    "10 Ago 2026"
  )
})

test("UX: OT multi-día muestra rango start → due", () => {
  assert.equal(
    formatOperationalDateRangeLabel("2026-08-08", "2026-08-10"),
    "08 Ago 2026 → 10 Ago 2026"
  )
})

test("UX: leyenda Obra con nombre y fallback", () => {
  assert.equal(resolveObraAgendaLegend("Residencial Norte"), "Obra: Residencial Norte")
  assert.equal(resolveObraAgendaLegend(""), "OT de Obra")
  assert.equal(resolveObraAgendaLegend(null), "OT de Obra")
})

test("GPS: OT con GPS propio prioriza task sobre Obra", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: { projectId: "p1", latitude: LAT, longitude: LNG },
    project: { latitude: OBRA_LAT, longitude: OBRA_LNG },
  })
  assert.deepEqual(resolved, { latitude: LAT, longitude: LNG, source: "task" })
})

test("GPS: OT sin GPS usa GPS de Obra", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: { projectId: "p1", latitude: null, longitude: null },
    project: { latitude: OBRA_LAT, longitude: OBRA_LNG },
  })
  assert.deepEqual(resolved, {
    latitude: OBRA_LAT,
    longitude: OBRA_LNG,
    source: "project",
  })
})

test("GPS: sin OT ni Obra → null + mensaje", () => {
  assert.equal(
    resolveTaskStartCoordinatesFromSources({
      task: { projectId: "p1", latitude: null, longitude: null },
      project: { latitude: null, longitude: null },
    }),
    null
  )
  assert.match(
    buildTaskStartLocationRequiredMessage(true),
    /OT y la Obra no tienen ubicación GPS/
  )
})

test("agenda API wires startDate, dateLabel and obraLabel", () => {
  const service = read("lib/mobile/v1/agenda/agenda-service.ts")
  assert.match(service, /startDate/)
  assert.match(service, /dateLabel/)
  assert.match(service, /obraLabel/)
  assert.match(service, /isProjectTask/)
  assert.match(service, /formatOperationalDateRangeLabel/)
})

test("project task dialog exposes optional OT GPS", () => {
  const dialog = read("components/obras/project-task-dialog.tsx")
  assert.match(dialog, /GPS de la OT \(opcional\)/)
  assert.match(dialog, /LocationInput/)
})
