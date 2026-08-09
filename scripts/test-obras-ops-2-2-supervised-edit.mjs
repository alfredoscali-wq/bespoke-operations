/**
 * OPS 2.2 — supervised edit of Obra OTs in execution.
 */
import assert from "node:assert/strict"
import test from "node:test"

import { canEditProjectTaskFromObras } from "../lib/projects/project-start-dispatch.ts"
import { resolveProjectTaskRowActions } from "../lib/projects/project-task-row-actions.ts"
import {
  assertProjectTaskSupervisedEditPayloadSafe,
  buildProjectTaskSupervisedEditFieldChanges,
  formatProjectTaskSupervisedEditHistoryNote,
  OBRAS_SUPERVISED_EDIT_STATUSES,
} from "../lib/projects/project-task-supervised-edit.ts"
import { shouldApplyPlanningQueueSideEffectsForTask } from "../lib/projects/project-start-dispatch.ts"
import {
  formatPlanningMultiDayBadge,
  formatPlanningTaskDateRangeLabel,
  resolvePlanningSpanDays,
} from "../lib/planificacion/planning-date-range.ts"

function makeObraTask(overrides = {}) {
  return {
    id: "obra-ot-1",
    code: "TSK-OB-001",
    title: "Cámara Norte",
    description: "desc",
    observationsForCrew: "obs",
    status: "en-curso",
    priority: "media",
    type: "fiber",
    projectId: "project-1",
    projectCode: "OB-1",
    projectName: "Obra Centro",
    crewId: "crew-1",
    crew: "Cuadrilla 1",
    supervisor: "Sup",
    startDate: "2026-08-08",
    dueDate: "2026-08-10",
    estimatedDuration: "24 h",
    latitude: -34.6,
    longitude: -58.4,
    sharedLocation: null,
    taskMetadata: {
      materialsNeeded: "Cable FO",
      operationalChecklistTemplate: [
        {
          id: "cl-1",
          title: "Fotos",
          fieldType: "photo",
          required: true,
          sortOrder: 1,
        },
      ],
    },
    checklist: [],
    operationalSteps: [],
    progress: 0,
    createdAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  }
}

test("OPS 2.2: estados editables incluyen en-curso", () => {
  assert.deepEqual([...OBRAS_SUPERVISED_EDIT_STATUSES], [
    "borrador",
    "programada",
    "asignada",
    "en-curso",
  ])

  for (const status of OBRAS_SUPERVISED_EDIT_STATUSES) {
    assert.equal(
      canEditProjectTaskFromObras({ projectId: "p1", status }),
      true,
      status
    )
    assert.equal(
      resolveProjectTaskRowActions({
        projectId: "p1",
        status,
        progress: 0,
        completedAt: undefined,
        closedAt: undefined,
        operationalSteps: [],
      }).showEdit,
      true,
      `showEdit ${status}`
    )
  }

  assert.equal(
    canEditProjectTaskFromObras({
      projectId: "p1",
      status: "pendiente-cierre",
    }),
    false
  )
  assert.equal(
    canEditProjectTaskFromObras({ projectId: undefined, status: "en-curso" }),
    false
  )
})

test("OPS 2.2: payload seguro no incluye status/orden/identidad", () => {
  assert.equal(
    assertProjectTaskSupervisedEditPayloadSafe({
      title: "x",
      startDate: "2026-08-08",
      dueDate: "2026-08-11",
    }),
    true
  )
  assert.equal(
    assertProjectTaskSupervisedEditPayloadSafe({ status: "programada" }),
    false
  )
  assert.equal(
    assertProjectTaskSupervisedEditPayloadSafe({ executionOrder: 1 }),
    false
  )
  assert.equal(
    assertProjectTaskSupervisedEditPayloadSafe({ dispatchOrder: 1 }),
    false
  )
  assert.equal(
    assertProjectTaskSupervisedEditPayloadSafe({ projectId: "p2" }),
    false
  )
  assert.equal(
    assertProjectTaskSupervisedEditPayloadSafe({ type: "fiber" }),
    false
  )
})

test("OPS 2.2: historial campo a campo con actor", () => {
  const before = makeObraTask()
  const payload = {
    title: "Cámara Sur",
    dueDate: "2026-08-12",
    estimatedDuration: "32 h",
  }
  const changes = buildProjectTaskSupervisedEditFieldChanges(
    before,
    payload,
    "Cable FO + conectores"
  )

  assert.ok(changes.some((c) => c.campo === "título"))
  assert.ok(changes.some((c) => c.campo === "fecha fin"))
  assert.ok(changes.some((c) => c.campo === "duración estimada"))
  assert.ok(changes.some((c) => c.campo === "materiales necesarios"))

  const note = formatProjectTaskSupervisedEditHistoryNote(changes, {
    actor: "Ana Perez",
    at: "2026-08-09T15:00:00.000Z",
  })
  assert.ok(note)
  assert.match(note, /Ana Perez/)
  assert.match(note, /título/)
  assert.match(note, /Cámara Norte/)
  assert.match(note, /Cámara Sur/)
})

test("OPS 2.2: cambio de rango recalcula span/día sin side-effects de ruta", () => {
  const before = makeObraTask()
  const after = makeObraTask({ dueDate: "2026-08-12" })

  assert.equal(resolvePlanningSpanDays(before), 3)
  assert.equal(resolvePlanningSpanDays(after), 5)
  assert.equal(
    formatPlanningMultiDayBadge(after, "2026-08-09"),
    "Día 2 de 5"
  )
  assert.match(formatPlanningTaskDateRangeLabel(after), /→/)

  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: after.projectId,
      status: after.status,
    }),
    false
  )
})
