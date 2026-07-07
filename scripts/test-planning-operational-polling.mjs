import assert from "node:assert/strict"
import test from "node:test"

import {
  PLANNING_OPERATIONAL_POLL_INTERVAL_MS,
  PLANNING_OPERATIONAL_POLL_REFRESH_TARGETS,
  createPlanningOperationalPollGuard,
  shouldInvalidateTaskDetailOnPlanningRefresh,
  shouldShowPlanningIncidentsLoaderOnRefresh,
  shouldSkipPlanningOperationalPoll,
  shouldTriggerPlanningOperationalPollOnVisibility,
} from "../lib/planificacion/planning-operational-polling.ts"

test("polling usa intervalo de 15 segundos", () => {
  assert.equal(PLANNING_OPERATIONAL_POLL_INTERVAL_MS, 15_000)
})

test("polling refresca tareas, incidencias activas y pendientes de cierre", () => {
  assert.deepEqual(PLANNING_OPERATIONAL_POLL_REFRESH_TARGETS, [
    "tasks",
    "activeIncidents",
    "pendingClosure",
  ])
})

test("polling se omite cuando la pestaña no está visible", () => {
  assert.equal(
    shouldSkipPlanningOperationalPoll({
      isVisible: false,
      isRefreshing: false,
    }),
    true
  )
})

test("polling se omite mientras hay refresh en curso", () => {
  assert.equal(
    shouldSkipPlanningOperationalPoll({
      isVisible: true,
      isRefreshing: true,
    }),
    true
  )
})

test("polling puede ejecutarse con pestaña visible y sin refresh previo", () => {
  assert.equal(
    shouldSkipPlanningOperationalPoll({
      isVisible: true,
      isRefreshing: false,
    }),
    false
  )
})

test("guard evita requests solapadas", () => {
  const guard = createPlanningOperationalPollGuard()

  assert.equal(guard.tryBegin(), true)
  assert.equal(guard.isRefreshing, true)
  assert.equal(guard.tryBegin(), false)

  guard.end()

  assert.equal(guard.isRefreshing, false)
  assert.equal(guard.tryBegin(), true)
  guard.end()
})

test("refresh silencioso preserva detalle y evita loaders globales", () => {
  assert.equal(shouldInvalidateTaskDetailOnPlanningRefresh({ silent: true }), false)
  assert.equal(shouldInvalidateTaskDetailOnPlanningRefresh(), true)
  assert.equal(shouldShowPlanningIncidentsLoaderOnRefresh({ silent: true }), false)
  assert.equal(shouldShowPlanningIncidentsLoaderOnRefresh(), true)
})

test("al volver visible la pestaña dispara refresh", () => {
  assert.equal(shouldTriggerPlanningOperationalPollOnVisibility("visible"), true)
  assert.equal(shouldTriggerPlanningOperationalPollOnVisibility("hidden"), false)
})

test("refresh silencioso no fuerza invalidación de selección ni detalle", () => {
  assert.equal(
    shouldInvalidateTaskDetailOnPlanningRefresh({ silent: true }),
    false,
    "detailVersion no debe incrementarse en polling"
  )
})
