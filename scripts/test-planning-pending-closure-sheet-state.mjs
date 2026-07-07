import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizePlanningPendingClosureSelectionId,
  resolvePlanningPendingClosureSheetViewPhase,
  shouldClearPlanningPendingClosureSelectionOnSheetClose,
} from "../lib/planificacion/planning-pending-closure-sheet-state.ts"

const EXISTING_TASK_ID = "4994b379-0c26-4e4e-91ac-0b138e87bb3d"

test("normalizePlanningPendingClosureSelectionId keeps existing task UUID", () => {
  assert.equal(
    normalizePlanningPendingClosureSelectionId(EXISTING_TASK_ID),
    EXISTING_TASK_ID
  )
})

test("normalizePlanningPendingClosureSelectionId rejects empty and invalid values", () => {
  assert.equal(normalizePlanningPendingClosureSelectionId(""), null)
  assert.equal(normalizePlanningPendingClosureSelectionId("   "), null)
  assert.equal(normalizePlanningPendingClosureSelectionId(undefined), null)
  assert.equal(normalizePlanningPendingClosureSelectionId(null), null)
})

test("selection flow moves from LIST to LOADING to DETAIL", () => {
  assert.equal(
    resolvePlanningPendingClosureSheetViewPhase({
      selectedTaskId: null,
      detailLoading: false,
      detailError: null,
      hasSelectedTask: false,
      hasSelectedDetail: false,
    }),
    "LIST"
  )

  assert.equal(
    resolvePlanningPendingClosureSheetViewPhase({
      selectedTaskId: EXISTING_TASK_ID,
      detailLoading: true,
      detailError: null,
      hasSelectedTask: false,
      hasSelectedDetail: false,
    }),
    "LOADING"
  )

  assert.equal(
    resolvePlanningPendingClosureSheetViewPhase({
      selectedTaskId: EXISTING_TASK_ID,
      detailLoading: false,
      detailError: null,
      hasSelectedTask: true,
      hasSelectedDetail: true,
    }),
    "DETAIL"
  )
})

test("selection flow surfaces missing detail as ERROR", () => {
  assert.equal(
    resolvePlanningPendingClosureSheetViewPhase({
      selectedTaskId: EXISTING_TASK_ID,
      detailLoading: false,
      detailError: "No fue posible cargar el detalle de la OT.",
      hasSelectedTask: true,
      hasSelectedDetail: false,
    }),
    "ERROR"
  )
})

test("sheet close clears selection in parent orchestration", () => {
  assert.equal(
    shouldClearPlanningPendingClosureSelectionOnSheetClose(false),
    true
  )
  assert.equal(
    shouldClearPlanningPendingClosureSelectionOnSheetClose(true),
    false
  )
})
