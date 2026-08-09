import assert from "node:assert/strict"
import test from "node:test"

import {
  formatPlanningMultiDayBadge,
  isTaskActiveOnPlanningDate,
  resolvePlanningDayDurationMinutes,
  resolvePlanningDayIndex,
  resolvePlanningSpanDays,
} from "../lib/planificacion/planning-date-range.ts"
import {
  filterPlanningOperationalViewTasks,
  filterPlanningSessionTasks,
} from "../lib/planificacion/planning-crew-state.ts"
import {
  filterConfirmedDispatchTasksForPlanning,
  filterProgrammedTasksForPlanningDate,
} from "../lib/planificacion/planning-dispatch.ts"
import { filterProgrammedTasksForPlanning } from "../lib/planificacion/planning-utils.ts"
import { buildPlanningCrewSummaries } from "../lib/planificacion/planning-utils.ts"
import { calculatePlanningSummary } from "../lib/planificacion/planning-summary.ts"
import { filterOperationalOrderScope } from "../lib/planificacion/planning-operational-order-core.ts"

function makeMultiDayObra(overrides = {}) {
  return {
    id: "obra-1",
    code: "TSK-OB-1",
    status: "programada",
    crewId: "crew-1",
    crew: "Cuadrilla 1",
    startDate: "2026-08-08",
    dueDate: "2026-08-10",
    estimatedDuration: "24 h",
    projectId: "project-1",
    projectCode: "OB-001",
    projectName: "Obra Norte",
    serviceType: null,
    ...overrides,
  }
}

function makeSingleDayOt(overrides = {}) {
  return {
    id: "ot-1",
    code: "TSK-OT-001",
    status: "programada",
    crewId: "crew-1",
    crew: "Cuadrilla 1",
    startDate: "2026-08-09",
    dueDate: "2026-08-09",
    estimatedDuration: "60 min",
    projectId: undefined,
    projectCode: "OT",
    projectName: "Cliente",
    serviceType: "service-tecnico",
    ...overrides,
  }
}

test("isTaskActiveOnPlanningDate: rango inclusivo 08→10", () => {
  const task = makeMultiDayObra()
  assert.equal(isTaskActiveOnPlanningDate(task, "2026-08-07"), false)
  assert.equal(isTaskActiveOnPlanningDate(task, "2026-08-08"), true)
  assert.equal(isTaskActiveOnPlanningDate(task, "2026-08-09"), true)
  assert.equal(isTaskActiveOnPlanningDate(task, "2026-08-10"), true)
  assert.equal(isTaskActiveOnPlanningDate(task, "2026-08-11"), false)
})

test("isTaskActiveOnPlanningDate: start vacío usa due", () => {
  const task = makeMultiDayObra({ startDate: "", dueDate: "2026-08-10" })
  assert.equal(isTaskActiveOnPlanningDate(task, "2026-08-10"), true)
  assert.equal(isTaskActiveOnPlanningDate(task, "2026-08-09"), false)
})

test("resolvePlanningSpanDays y day index", () => {
  const task = makeMultiDayObra()
  assert.equal(resolvePlanningSpanDays(task), 3)
  assert.equal(resolvePlanningDayIndex(task, "2026-08-08"), 1)
  assert.equal(resolvePlanningDayIndex(task, "2026-08-09"), 2)
  assert.equal(resolvePlanningDayIndex(task, "2026-08-10"), 3)
  assert.equal(resolvePlanningDayIndex(task, "2026-08-11"), null)
})

test("resolvePlanningDayDurationMinutes: 24h / 3 = 8h por día", () => {
  const task = makeMultiDayObra()
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-08"), 480)
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-09"), 480)
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-10"), 480)
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-07"), 0)
})

test("resolvePlanningDayDurationMinutes: resto en últimos días", () => {
  const task = makeMultiDayObra({ estimatedDuration: "25 h" })
  // 1500 min / 3 = 500 + remainder 0? 25*60=1500, 1500/3=500 exact
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-08"), 500)
  const uneven = makeMultiDayObra({ estimatedDuration: "100 min" })
  // 100/3 = 33 rem 1 → last day gets +1
  assert.equal(resolvePlanningDayDurationMinutes(uneven, "2026-08-08"), 33)
  assert.equal(resolvePlanningDayDurationMinutes(uneven, "2026-08-09"), 33)
  assert.equal(resolvePlanningDayDurationMinutes(uneven, "2026-08-10"), 34)
})

test("badge Día X de Y", () => {
  const task = makeMultiDayObra()
  assert.equal(formatPlanningMultiDayBadge(task, "2026-08-09"), "Día 2 de 3")
  assert.equal(formatPlanningMultiDayBadge(makeSingleDayOt(), "2026-08-09"), null)
})

test("filtros planning proyectan OT en los 3 días (misma fila)", () => {
  const tasks = [makeMultiDayObra(), makeSingleDayOt()]
  for (const date of ["2026-08-08", "2026-08-09", "2026-08-10"]) {
    const view = filterPlanningOperationalViewTasks(tasks, { date })
    assert.ok(
      view.some((t) => t.id === "obra-1"),
      `obra visible en ${date}`
    )
    assert.equal(view.filter((t) => t.id === "obra-1").length, 1)
  }

  assert.equal(
    filterPlanningOperationalViewTasks(tasks, { date: "2026-08-07" }).some(
      (t) => t.id === "obra-1"
    ),
    false
  )

  assert.ok(
    filterProgrammedTasksForPlanning(tasks, { date: "2026-08-09" }).some(
      (t) => t.id === "obra-1"
    )
  )
  assert.ok(
    filterProgrammedTasksForPlanningDate(tasks, { date: "2026-08-08" }).some(
      (t) => t.id === "obra-1"
    )
  )
  assert.ok(
    filterPlanningSessionTasks(tasks, { date: "2026-08-10" }).some(
      (t) => t.id === "obra-1"
    )
  )
})

test("confirmed mode también usa rango", () => {
  const tasks = [makeMultiDayObra({ status: "asignada" })]
  assert.ok(
    filterConfirmedDispatchTasksForPlanning(tasks, {
      date: "2026-08-09",
    }).some((t) => t.id === "obra-1")
  )
})

test("KPI cuadrilla usa duración diaria no total", () => {
  const tasks = [makeMultiDayObra()]
  const crews = [
    {
      id: "crew-1",
      name: "Cuadrilla 1",
      habitualShiftMinutes: 480,
    },
  ]

  const mid = calculatePlanningSummary({
    tasks,
    crews,
    groupByCrew: false,
    planningDate: "2026-08-09",
  })
  assert.equal(mid.technicalMinutes, 480)

  const summaries = buildPlanningCrewSummaries(tasks, crews, "2026-08-08")
  assert.equal(summaries[0]?.technicalMinutes, 480)
  assert.ok((summaries[0]?.estimatedMinutes ?? 0) < 24 * 60)
})

test("order scope incluye OT multi-día en día intermedio", () => {
  const tasks = [makeMultiDayObra(), makeSingleDayOt()]
  const scope = filterOperationalOrderScope(tasks, "2026-08-09", "crew-1")
  assert.deepEqual(
    scope.map((t) => t.id).sort(),
    ["obra-1", "ot-1"].sort()
  )
})
