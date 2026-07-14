import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE,
  normalizeChecklistTechnologyScope,
  resolvePreferredChecklistTechnology,
  selectChecklistItemsForTechnologyCascade,
} from "../lib/work-order-types/checklist-technology.ts"
import {
  mergeTrabajoRealizadoIntoMetadata,
  readTrabajoRealizadoFromMetadata,
  validateTrabajoRealizado,
} from "../lib/tasks/trabajo-realizado.ts"
import { TASK_START_DISTANCE_ENFORCEMENT_ENABLED } from "../lib/mobile/v1/tasks/geo-utils.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

test("checklist cascade usa tecnología exacta cuando existe", () => {
  const items = [
    { id: "1", technology: "todas", title: "Genérico" },
    { id: "2", technology: "fiber", title: "Fibra" },
    { id: "3", technology: "wireless", title: "Wireless" },
  ]

  assert.deepEqual(
    selectChecklistItemsForTechnologyCascade(items, "fiber").map((item) => item.id),
    ["2"]
  )
  assert.deepEqual(
    selectChecklistItemsForTechnologyCascade(items, "wireless").map(
      (item) => item.id
    ),
    ["3"]
  )
})

test("checklist cascade cae a Todas cuando no hay específica", () => {
  const items = [
    { id: "1", technology: "todas", title: "Genérico" },
    { id: "2", technology: "fiber", title: "Fibra" },
  ]

  assert.deepEqual(
    selectChecklistItemsForTechnologyCascade(items, "wireless").map(
      (item) => item.id
    ),
    ["1"]
  )
})

test("checklist cascade sin tecnología usa Todas", () => {
  const items = [
    { id: "1", technology: "todas", title: "Genérico" },
    { id: "2", technology: "fiber", title: "Fibra" },
  ]

  assert.deepEqual(
    selectChecklistItemsForTechnologyCascade(items, "").map((item) => item.id),
    ["1"]
  )
  assert.equal(resolvePreferredChecklistTechnology(""), null)
  assert.equal(
    normalizeChecklistTechnologyScope("otro"),
    DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE
  )
})

test("trabajo realizado es obligatorio y se guarda en metadata", () => {
  const invalid = validateTrabajoRealizado("   ")
  assert.equal(invalid.ok, false)

  const valid = validateTrabajoRealizado(" Se cambió acometida. ")
  assert.equal(valid.ok, true)
  if (!valid.ok) {
    throw new Error("expected valid")
  }

  const metadata = mergeTrabajoRealizadoIntoMetadata(
    { technology: "fiber" },
    valid.value
  )
  assert.equal(metadata.technology, "fiber")
  assert.equal(readTrabajoRealizadoFromMetadata(metadata), "Se cambió acometida.")
})

test("GPS distance enforcement queda desactivado sin eliminar la lógica", () => {
  assert.equal(TASK_START_DISTANCE_ENFORCEMENT_ENABLED, false)

  const startService = readFileSync(
    join(__dirname, "../lib/mobile/v1/tasks/task-start-service.ts"),
    "utf8"
  )
  assert.match(startService, /evaluateTaskStartDistancePolicy/)
  assert.match(startService, /distancePolicy\.shouldBlock/)
  assert.match(startService, /TASK_LOCATION_OUT_OF_RANGE/)
})

test("config de checklist y submit mobile usan tecnología / trabajo realizado", () => {
  const configModule = readFileSync(
    join(
      __dirname,
      "../components/configuracion/work-order-types-config-module.tsx"
    ),
    "utf8"
  )
  assert.match(configModule, /CHECKLIST_TECHNOLOGY_SCOPE_OPTIONS/)
  assert.match(configModule, /selectedTechnology/)

  const submitService = readFileSync(
    join(__dirname, "../lib/mobile/v1/tasks/task-submit-service.ts"),
    "utf8"
  )
  assert.match(submitService, /validateTrabajoRealizado/)
  assert.match(submitService, /mergeTrabajoRealizadoIntoMetadata/)

  const obraDialog = readFileSync(
    join(__dirname, "../components/obras/project-task-dialog.tsx"),
    "utf8"
  )
  assert.match(obraDialog, /Información para la Cuadrilla/)
  assert.match(obraDialog, /observationsForCrew/)

  const workOrderDialog = readFileSync(
    join(__dirname, "../components/tareas/task-work-order-dialog.tsx"),
    "utf8"
  )
  assert.match(workOrderDialog, /WorkOrderCrewInfoFields/)
  assert.match(workOrderDialog, /observationsForCrew/)
  assert.match(workOrderDialog, /Información para la Cuadrilla/)
  assert.doesNotMatch(
    workOrderDialog,
    /<SectionTitle>Observaciones<\/SectionTitle>/
  )
  assert.doesNotMatch(workOrderDialog, /updateField\("observations"/)
})
