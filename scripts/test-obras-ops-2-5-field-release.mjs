/**
 * OPS 2.5 — release / return Obra OTs to Field Agent.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  canReleaseProjectTaskToField,
  canReturnProjectTaskToPlanning,
  releaseProjectTaskToField,
  resolveProjectTaskFieldDispatchBadge,
  returnProjectTaskToPlanning,
} from "../lib/projects/project-task-field-release.ts"
import { resolveProjectTaskRowActions } from "../lib/projects/project-task-row-actions.ts"
import { getTransitionForAction } from "../lib/tasks/task-status-workflow.ts"
import {
  isFieldAgentAgendaTaskVisible,
  isOperationalDateRangeActive,
} from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"
import { shouldApplyPlanningQueueSideEffectsForTask } from "../lib/projects/project-start-dispatch.ts"

const base = {
  projectId: "project-1",
  crewId: "crew-1",
  crew: "Cuadrilla A",
}

test("OPS 2.5: release programada → asignada", () => {
  const result = releaseProjectTaskToField({
    ...base,
    status: "programada",
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.status, "asignada")
  assert.equal(
    canReleaseProjectTaskToField({ ...base, status: "programada" }),
    true
  )
  assert.equal(
    canReleaseProjectTaskToField({ ...base, status: "asignada" }),
    false
  )
  assert.equal(
    releaseProjectTaskToField({
      projectId: "p1",
      status: "programada",
      crewId: undefined,
      crew: "",
    }).ok,
    false
  )
})

test("OPS 2.5: return solo desde asignada", () => {
  const ok = returnProjectTaskToPlanning({
    projectId: "p1",
    status: "asignada",
  })
  assert.equal(ok.ok, true)
  if (ok.ok) assert.equal(ok.status, "programada")

  assert.equal(
    returnProjectTaskToPlanning({ projectId: "p1", status: "en-curso" }).ok,
    false
  )
  assert.equal(
    returnProjectTaskToPlanning({
      projectId: "p1",
      status: "pendiente-cierre",
    }).ok,
    false
  )
  assert.equal(
    returnProjectTaskToPlanning({ projectId: "p1", status: "finalizada" }).ok,
    false
  )
  assert.equal(
    returnProjectTaskToPlanning({ projectId: "p1", status: "programada" }).ok,
    false
  )
  assert.equal(canReturnProjectTaskToPlanning({ ...base, status: "asignada" }), true)
})

test("OPS 2.5: workflow actions", () => {
  assert.deepEqual(getTransitionForAction("release-obra-to-field"), {
    from: ["programada"],
    to: "asignada",
  })
  assert.deepEqual(getTransitionForAction("return-obra-from-field"), {
    from: ["asignada"],
    to: "programada",
  })
})

test("OPS 2.5: badges y row actions", () => {
  assert.equal(
    resolveProjectTaskFieldDispatchBadge({
      projectId: "p1",
      status: "programada",
    }),
    "Pendiente de envío"
  )
  assert.equal(
    resolveProjectTaskFieldDispatchBadge({
      projectId: "p1",
      status: "asignada",
    }),
    "Enviada a campo"
  )
  assert.equal(
    resolveProjectTaskFieldDispatchBadge({
      projectId: "p1",
      status: "en-curso",
    }),
    null
  )

  const programmed = resolveProjectTaskRowActions({
    ...base,
    status: "programada",
    progress: 0,
    completedAt: null,
    closedAt: null,
    operationalSteps: [],
  })
  assert.equal(programmed.showReleaseToField, true)
  assert.equal(programmed.showReturnFromField, false)

  const assigned = resolveProjectTaskRowActions({
    ...base,
    status: "asignada",
    progress: 0,
    completedAt: null,
    closedAt: null,
    operationalSteps: [],
  })
  assert.equal(assigned.showReleaseToField, false)
  assert.equal(assigned.showReturnFromField, true)
})

test("OPS 2.5: FA no muestra Obra programada", () => {
  const today = "2026-08-09"
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: today,
        dueDate: "2026-08-20",
        projectId: "p1",
        crewId: "crew-1",
      },
      today
    ),
    false
  )
})

test("OPS 2.5: FA muestra asignada solo desde start_date", () => {
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-20", dueDate: "2026-08-25" },
      "2026-08-18"
    ),
    false
  )
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-20", dueDate: "2026-08-25" },
      "2026-08-19"
    ),
    false
  )
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-20", dueDate: "2026-08-25" },
      "2026-08-20"
    ),
    true
  )

  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: "2026-08-20",
        dueDate: "2026-08-25",
        projectId: "p1",
        crewId: "crew-1",
      },
      "2026-08-19"
    ),
    false
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: "2026-08-20",
        dueDate: "2026-08-25",
        projectId: "p1",
        crewId: "crew-1",
      },
      "2026-08-20"
    ),
    true
  )
})

test("OPS 2.5: release no implica side-effects de ruta", () => {
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: "p1",
      status: "asignada",
    }),
    false
  )
})
