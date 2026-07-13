import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  hasPlanningTaskCrewObservations,
  resolvePlanningTaskCrewObservations,
} from "../lib/planificacion/planning-task-observations.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

test("resolvePlanningTaskCrewObservations prioriza observationsForCrew", () => {
  assert.equal(
    resolvePlanningTaskCrewObservations({
      observationsForCrew: "Portón negro",
      description: "Nota interna",
    }),
    "Portón negro"
  )
})

test("resolvePlanningTaskCrewObservations usa description como respaldo", () => {
  assert.equal(
    resolvePlanningTaskCrewObservations({
      observationsForCrew: "",
      description: "Cliente solicita turno tarde",
    }),
    "Cliente solicita turno tarde"
  )
})

test("hasPlanningTaskCrewObservations ignora espacios", () => {
  assert.equal(
    hasPlanningTaskCrewObservations({
      observationsForCrew: "   ",
      description: "",
    }),
    false
  )
})

test("planning task row muestra indicador de observaciones junto al cliente", () => {
  const source = readFileSync(
    join(__dirname, "../components/planificacion/planning-task-table-row.tsx"),
    "utf8"
  )

  assert.match(source, /AlertCircle/)
  assert.match(source, /hasPlanningTaskCrewObservations/)
  assert.match(source, /Observaciones para revisar/)
})

test("planning map overlay muestra observaciones debajo del detalle", () => {
  const source = readFileSync(
    join(__dirname, "../components/planificacion/planning-map.tsx"),
    "utf8"
  )

  assert.match(source, /PlanningTaskObservationsBlock/)
  assert.match(source, /Observaciones para la cuadrilla/)
})
