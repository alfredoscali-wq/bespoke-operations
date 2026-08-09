/**
 * OPS 2.4 — Obra incident resolve from Planning > Obras activas.
 */
import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanningObraActiveRows } from "../lib/planificacion/planning-obras-lane.ts"
import {
  assertProjectTaskIncidentResolvePayloadSafe,
  buildProjectTaskIncidentResolvePayload,
  canResolveProjectTaskIncidentFromPlanning,
  formatProjectTaskIncidentResolveHistoryNote,
  validateProjectTaskIncidentResolveInput,
} from "../lib/projects/project-task-incident-resolve.ts"
import { getTransitionForAction } from "../lib/tasks/task-status-workflow.ts"
import { isFieldAgentAgendaTaskVisible } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"
import { shouldApplyPlanningQueueSideEffectsForTask } from "../lib/projects/project-start-dispatch.ts"

function makeObraTask(overrides = {}) {
  return {
    id: "obra-1",
    code: "OT-OBRA-1",
    title: "Instalación fibra",
    projectId: "project-1",
    projectName: "Obra Norte",
    projectCode: "OB-1",
    status: "incidencia",
    dueDate: "2026-08-12",
    startDate: "2026-08-09",
    crewId: "crew-1",
    crew: "Cuadrilla A",
    estimatedDuration: "480",
    incidentReason: "material-insuficiente",
    incidentReportedAt: "2026-08-09T14:30:00.000Z",
    incidentReportedBy: "Operario Pérez",
    observationsForCrew: "Falta cable",
    taskMetadata: { materialsNeeded: "Cable drop" },
    ...overrides,
  }
}

test("OPS 2.4: solo OT Obra en incidencia es resoluble desde Planificación", () => {
  assert.equal(
    canResolveProjectTaskIncidentFromPlanning(makeObraTask()),
    true
  )
  assert.equal(
    canResolveProjectTaskIncidentFromPlanning(
      makeObraTask({ status: "programada" })
    ),
    false
  )
  assert.equal(
    canResolveProjectTaskIncidentFromPlanning(
      makeObraTask({ projectId: undefined })
    ),
    false
  )
})

test("OPS 2.4: workflow resolve-obra-incident → programada", () => {
  assert.deepEqual(getTransitionForAction("resolve-obra-incident"), {
    from: ["incidencia"],
    to: "programada",
  })
})

test("OPS 2.4: payload devolver a programada sin órdenes de ruta", () => {
  const payload = buildProjectTaskIncidentResolvePayload(makeObraTask(), {
    decision: "return-to-programmed",
    observationsForCrew: "Material en camino",
    materialsNeeded: "Cable + conectores",
    startDate: "2026-08-09",
    dueDate: "2026-08-14",
  })

  assert.equal(payload.status, "programada")
  assert.equal(payload.startDate, "2026-08-09")
  assert.equal(payload.dueDate, "2026-08-14")
  assert.equal(payload.observationsForCrew, "Material en camino")
  assert.equal(payload.taskMetadata?.materialsNeeded, "Cable + conectores")
  assert.equal(payload.executionOrder, undefined)
  assert.equal(payload.dispatchOrder, undefined)
  assert.equal(assertProjectTaskIncidentResolvePayloadSafe(payload), true)
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: "project-1",
      status: "programada",
    }),
    false
  )
})

test("OPS 2.4: mantener incidencia no cambia status", () => {
  const payload = buildProjectTaskIncidentResolvePayload(makeObraTask(), {
    decision: "keep-incident",
    observationsForCrew: "Esperando material",
    materialsNeeded: "Cable",
    startDate: "2026-08-09",
    dueDate: "2026-08-15",
  })

  assert.equal(payload.status, undefined)
  assert.equal(payload.dueDate, "2026-08-15")
})

test("OPS 2.4: valida rango de fechas", () => {
  const invalid = validateProjectTaskIncidentResolveInput({
    decision: "return-to-programmed",
    observationsForCrew: "",
    materialsNeeded: "",
    startDate: "2026-08-15",
    dueDate: "2026-08-10",
  })
  assert.equal(invalid.ok, false)

  const valid = validateProjectTaskIncidentResolveInput({
    decision: "keep-incident",
    observationsForCrew: "",
    materialsNeeded: "",
    startDate: "2026-08-09",
    dueDate: "2026-08-12",
  })
  assert.equal(valid.ok, true)
})

test("OPS 2.4: fila Obras Activas expone datos de incidencia", () => {
  const rows = buildPlanningObraActiveRows(
    [makeObraTask(), makeObraTask({ id: "obra-2", code: "OT-OBRA-2", status: "programada", incidentReason: undefined })],
    "2026-08-09",
    [{ id: "crew-1", name: "Cuadrilla A" }]
  )

  assert.equal(rows[0]?.hasOpenIncident, true)
  assert.equal(rows[0]?.incidentReasonLabel, "Material insuficiente")
  assert.equal(rows[0]?.incidentReportedBy, "Operario Pérez")
  assert.equal(rows[0]?.projectId, "project-1")
  assert.equal(rows[1]?.hasOpenIncident, false)
  assert.equal(rows[1]?.incidentReasonLabel, null)
})

test("OPS 2.4: tras resolver a programada, FA no la ve hasta liberar (OPS 2.5)", () => {
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: "2026-08-09",
        dueDate: "2026-08-14",
        projectId: "project-1",
        crewId: "crew-1",
      },
      "2026-08-10"
    ),
    false
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: "2026-08-09",
        dueDate: "2026-08-14",
        projectId: "project-1",
        crewId: "crew-1",
      },
      "2026-08-10"
    ),
    true
  )
})

test("OPS 2.4: historial de resolución", () => {
  const note = formatProjectTaskIncidentResolveHistoryNote(
    {
      decision: "return-to-programmed",
      observationsForCrew: "ok",
      materialsNeeded: "",
      startDate: "2026-08-09",
      dueDate: "2026-08-14",
    },
    { actor: "Supervisor" }
  )
  assert.match(note, /Supervisor/)
  assert.match(note, /programada/)
})
