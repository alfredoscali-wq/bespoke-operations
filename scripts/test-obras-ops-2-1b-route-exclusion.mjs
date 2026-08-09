/**
 * OPS 2.1B — OT de Obra fuera de execution_order / dispatch_order / Planificar-Replanificar.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  filterObraPlanningTasksForDate,
  filterPlanningSessionTasks,
  resolveCrewPlanningButtonVisibility,
} from "../lib/planificacion/planning-crew-state.ts"
import {
  filterConfirmedDispatchTasksForPlanning,
  filterProgrammedTasksForPlanningDate,
} from "../lib/planificacion/planning-dispatch.ts"
import { filterOperationalOrderScope } from "../lib/planificacion/planning-operational-order-core.ts"
import {
  computePlanningObrasKpis,
  computePlanningOperativeKpis,
} from "../lib/planificacion/planning-obras-lane.ts"
import {
  isObraPlanningTask,
  isOperationalRouteTask,
} from "../lib/planificacion/planning-universe.ts"
import { filterProgrammedTasksForPlanning } from "../lib/planificacion/planning-utils.ts"
import { shouldApplyPlanningQueueSideEffectsForTask } from "../lib/projects/project-start-dispatch.ts"
import { sortAgendaTasks } from "../lib/mobile/v1/agenda/sort-agenda-tasks.ts"
import { isFieldAgentAgendaTaskVisible } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"
import {
  formatPlanningMultiDayBadge,
  isTaskActiveOnPlanningDate,
} from "../lib/planificacion/planning-date-range.ts"

function makeObra(overrides = {}) {
  return {
    id: "obra-1",
    code: "TSK-OB-1",
    title: "Cámara Norte",
    status: "programada",
    crewId: "crew-1",
    crew: "Cuadrilla 1",
    startDate: "2026-08-08",
    dueDate: "2026-08-10",
    estimatedDuration: "24 h",
    projectId: "project-1",
    projectCode: "OB-001",
    projectName: "Ampliación Barrio Centro",
    serviceType: null,
    executionOrder: null,
    dispatchOrder: null,
    ...overrides,
  }
}

function makeRouteOt(overrides = {}) {
  return {
    id: "ot-1",
    code: "TSK-OT-001",
    title: "Instalación Pérez",
    status: "programada",
    crewId: "crew-1",
    crew: "Cuadrilla 1",
    startDate: "2026-08-09",
    dueDate: "2026-08-09",
    estimatedDuration: "60 min",
    projectId: undefined,
    projectCode: "OT",
    projectName: "Cliente",
    serviceType: "instalacion",
    executionOrder: 1,
    dispatchOrder: 1,
    ...overrides,
  }
}

const crew = { id: "crew-1", name: "Cuadrilla 1" }

test("universe: obra vs ruta", () => {
  assert.equal(isObraPlanningTask(makeObra()), true)
  assert.equal(isOperationalRouteTask(makeObra()), false)
  assert.equal(isOperationalRouteTask(makeRouteOt()), true)
})

test("CASO 1: obra visible en rango sin entrar a order scope", () => {
  const tasks = [makeObra(), makeRouteOt()]

  for (const date of ["2026-08-08", "2026-08-09", "2026-08-10"]) {
    assert.equal(isTaskActiveOnPlanningDate(makeObra(), date), true)
    const obras = filterObraPlanningTasksForDate(tasks, { date })
    assert.equal(obras.some((t) => t.id === "obra-1"), true)
    const scope = filterOperationalOrderScope(tasks, date, "crew-1")
    assert.equal(
      scope.some((t) => t.id === "obra-1"),
      false,
      `obra no debe estar en order scope el ${date}`
    )
  }

  const midScope = filterOperationalOrderScope(tasks, "2026-08-09", "crew-1")
  assert.deepEqual(
    midScope.map((t) => t.id),
    ["ot-1"]
  )
  assert.equal(formatPlanningMultiDayBadge(makeObra(), "2026-08-09"), "Día 2 de 3")
})

test("CASO 2: obra activa no fuerza Replanificar", () => {
  const tasks = [
    makeObra({
      startDate: "2026-08-08",
      dueDate: "2026-08-12",
      status: "asignada",
    }),
    makeRouteOt({ id: "ot-new", status: "programada", dueDate: "2026-08-09" }),
  ]

  const buttons = resolveCrewPlanningButtonVisibility(
    tasks,
    "2026-08-09",
    crew
  )
  assert.ok(buttons)
  assert.equal(buttons.showPlanificar, true)
  assert.equal(buttons.showReplanificar, false)

  const session = filterPlanningSessionTasks(tasks, { date: "2026-08-09" })
  assert.deepEqual(
    session.map((t) => t.id),
    ["ot-new"]
  )
})

test("CASO 3: mobile sort — obras primero; ruta mantiene orden", () => {
  const tasks = [
    makeRouteOt({
      id: "ot-b",
      dispatchOrder: 2,
      executionOrder: 2,
      title: "Service López",
    }),
    makeObra({ status: "asignada" }),
    makeRouteOt({
      id: "ot-a",
      dispatchOrder: 1,
      executionOrder: 1,
      title: "Instalación Pérez",
    }),
  ]

  const sorted = sortAgendaTasks(tasks)
  assert.equal(sorted[0]?.id, "obra-1")
  assert.deepEqual(
    sorted.slice(1).map((t) => t.id),
    ["ot-a", "ot-b"]
  )
})

test("CASO 3b: mobile visibility — Obra asignada en agenda; programada no", () => {
  const today = "2026-08-09"
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: "2026-08-08",
        dueDate: "2026-08-10",
        projectId: "project-1",
        crewId: "crew-1",
      },
      today
    ),
    false
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: "2026-08-08",
        dueDate: "2026-08-10",
        projectId: "project-1",
        crewId: "crew-1",
      },
      today
    ),
    true
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: today,
        dueDate: today,
        projectId: undefined,
      },
      today
    ),
    false
  )
})

test("side-effects: nunca para OT con projectId", () => {
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: "p1",
      status: "programada",
    }),
    false
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: null }),
    true
  )
})

test("filtros de ruta excluyen obra; lane obras la incluye", () => {
  const tasks = [makeObra(), makeRouteOt()]
  assert.equal(
    filterProgrammedTasksForPlanning(tasks, { date: "2026-08-09" }).some(
      (t) => t.id === "obra-1"
    ),
    false
  )
  assert.equal(
    filterProgrammedTasksForPlanningDate(tasks, { date: "2026-08-09" }).some(
      (t) => t.id === "obra-1"
    ),
    false
  )
  assert.equal(
    filterConfirmedDispatchTasksForPlanning(
      [makeObra({ status: "asignada" })],
      { date: "2026-08-09" }
    ).length,
    0
  )
  assert.equal(
    filterObraPlanningTasksForDate(tasks, { date: "2026-08-09" }).length,
    1
  )
})

test("KPIs operativos vs obras separados", () => {
  const route = [makeRouteOt(), makeRouteOt({ id: "ot-2", status: "asignada" })]
  const obras = [makeObra({ status: "asignada" })]
  const op = computePlanningOperativeKpis(route, "2026-08-09", 0)
  assert.equal(op.programmedCount, 1)
  assert.equal(op.assignedCount, 1)
  const ob = computePlanningObrasKpis(obras, "2026-08-09", [crew])
  assert.equal(ob.activeObrasCount, 1)
  assert.equal(ob.activeObraTaskCount, 1)
  assert.equal(ob.affectedCrewsCount, 1)
  assert.equal(ob.committedDayMinutes, 480)
})
