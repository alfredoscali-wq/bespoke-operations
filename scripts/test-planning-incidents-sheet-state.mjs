import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizePlanningIncidentSelectionId,
  resolvePlanningIncidentSheetViewPhase,
  shouldClearPlanningIncidentSelectionOnSheetClose,
} from "../lib/planificacion/planning-incidents-sheet-state.ts"

const EXISTING_INCIDENT_ID = "4994b379-0c26-4e4e-91ac-0b138e87bb3d"

test("normalizePlanningIncidentSelectionId keeps existing incident UUID", () => {
  assert.equal(
    normalizePlanningIncidentSelectionId(EXISTING_INCIDENT_ID),
    EXISTING_INCIDENT_ID
  )
})

test("normalizePlanningIncidentSelectionId rejects empty and invalid values", () => {
  assert.equal(normalizePlanningIncidentSelectionId(""), null)
  assert.equal(normalizePlanningIncidentSelectionId("   "), null)
  assert.equal(normalizePlanningIncidentSelectionId(undefined), null)
  assert.equal(normalizePlanningIncidentSelectionId(null), null)
})

test("selection flow moves from LIST to LOADING to DETAIL", () => {
  assert.equal(
    resolvePlanningIncidentSheetViewPhase({
      selectedIncidentId: null,
      detailLoading: false,
      detailError: null,
      hasSelectedIncident: false,
    }),
    "LIST"
  )

  assert.equal(
    resolvePlanningIncidentSheetViewPhase({
      selectedIncidentId: EXISTING_INCIDENT_ID,
      detailLoading: true,
      detailError: null,
      hasSelectedIncident: false,
    }),
    "LOADING"
  )

  assert.equal(
    resolvePlanningIncidentSheetViewPhase({
      selectedIncidentId: EXISTING_INCIDENT_ID,
      detailLoading: false,
      detailError: null,
      hasSelectedIncident: true,
    }),
    "DETAIL"
  )
})

test("selection flow surfaces GET failures as ERROR", () => {
  assert.equal(
    resolvePlanningIncidentSheetViewPhase({
      selectedIncidentId: EXISTING_INCIDENT_ID,
      detailLoading: false,
      detailError: "No fue posible cargar la incidencia.",
      hasSelectedIncident: false,
    }),
    "ERROR"
  )
})

test("sheet close clears selection in parent orchestration", () => {
  assert.equal(shouldClearPlanningIncidentSelectionOnSheetClose(false), true)
  assert.equal(shouldClearPlanningIncidentSelectionOnSheetClose(true), false)
})
