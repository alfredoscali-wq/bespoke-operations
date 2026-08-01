import assert from "node:assert/strict"
import test from "node:test"

import { QueryClient } from "@tanstack/react-query"

import {
  PLANNING_READ_GC_TIME_MS,
  PLANNING_READ_QUERY_DEFAULTS,
  PLANNING_READ_STALE_TIME_MS,
  buildPlanningReadCacheKey,
  buildPlanningReadModel,
  clearPlanningReadCache,
  getCachedPlanningReadModel,
  getOrBuildPlanningReadModel,
  getPlanningReadCacheSize,
  planningQueryKeys,
  setCachedPlanningReadModel,
} from "../lib/planning/read-model/index.ts"
import {
  filterConfirmedDispatchTasksForPlanning,
  filterProgrammedTasksForPlanningDate,
} from "../lib/planificacion/planning-dispatch.ts"
import { filterPlanningOperationalViewTasks } from "../lib/planificacion/planning-crew-state.ts"
import { listPendingClosureTasksForPlanningDate } from "../lib/planificacion/planning-pending-closure.ts"
import {
  buildPlanningCrewSummaries,
  filterPlanningTasksByCrewFilter,
} from "../lib/planificacion/planning-utils.ts"
import { isCrewAssignable } from "../lib/crews/status-workflow.ts"
import { sortTasksByDispatchRoute } from "../lib/tasks/dispatch-order.ts"

function makeCrew(id, name) {
  return {
    id,
    name,
    description: "",
    supervisor: "Sup",
    status: "activa",
    notes: "",
    origin: "internal",
    members: [
      {
        id: `m-${id}`,
        crewId: id,
        employeeId: `e-${id}`,
        name: "Operario",
        role: "operario",
        active: true,
      },
    ],
    habitualShiftMinutes: 480,
  }
}

function makeTask(overrides = {}) {
  return {
    id: "t1",
    code: "OT-1",
    title: "Instalacion",
    description: "",
    projectId: "p1",
    projectCode: "OB-1",
    projectName: "Obra Centro",
    type: "fiber",
    status: "asignada",
    priority: "media",
    supervisor: "Sup",
    crewId: "c1",
    crew: "Cuadrilla 1",
    startDate: "2026-08-01",
    dueDate: "2026-08-01",
    scheduledTime: "08:00",
    estimatedDuration: "60",
    checklist: [],
    operationalSteps: [],
    progress: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    serviceType: "instalacion",
    locality: "CABA",
    taskMetadata: {},
    latitude: -34.6,
    longitude: -58.4,
    ...overrides,
  }
}

function sampleInput(overrides = {}) {
  const crew = makeCrew("c1", "Cuadrilla 1")
  const task = makeTask()
  return {
    date: "2026-08-01",
    crewFilterId: "c1",
    overdueFilterActive: false,
    dayConfigRevision: 0,
    tasks: [task],
    crews: [crew],
    employees: [
      {
        id: "e-c1",
        companyId: "co",
        employeeCode: "E1",
        firstName: "Ana",
        lastName: "Perez",
        jobTitle: "Operario",
        department: "Campo",
        employeeType: "operario",
        employmentStatus: "active",
        notes: "",
        systemRole: "operario",
        systemAccess: true,
        mustChangePassword: false,
      },
    ],
    activeIncidents: [],
    activeIncidentsCount: 0,
    ...overrides,
  }
}

test("Sprint 19: read model construction includes jornada slices", () => {
  clearPlanningReadCache()
  const model = buildPlanningReadModel(sampleInput())

  assert.equal(model.date, "2026-08-01")
  assert.equal(model.crews.length, 1)
  assert.equal(model.employees.length, 1)
  assert.equal(model.availability.length, 1)
  assert.equal(model.obras.length, 1)
  assert.equal(model.obras[0].code, "OB-1")
  assert.equal(model.tasks.list.length, 1)
  assert.equal(model.agenda.orderedTaskIds[0], "t1")
  assert.ok(
    model.metrics.dispatchMode === "editing" ||
      model.metrics.dispatchMode === "confirmed"
  )
  assert.equal(
    model.metrics.dispatchMode,
    model.metrics.isConfirmedMode ? "confirmed" : "editing"
  )
  assert.ok(model.metrics.crewSummaries.length >= 1)
  assert.ok(model.metrics.crewPlanningSummary)
  assert.equal(model.activeCrewFilterName, "Cuadrilla 1")
})

test("Sprint 19: functional equality vs legacy derivation helpers", () => {
  const input = sampleInput()
  const model = buildPlanningReadModel(input)
  const activeCrews = input.crews.filter(isCrewAssignable)
  const filtered = filterPlanningOperationalViewTasks(input.tasks, {
    date: input.date,
  })
  const list = filterPlanningTasksByCrewFilter(
    filtered,
    input.crewFilterId,
    activeCrews
  )
  const summaries = buildPlanningCrewSummaries([...filtered], activeCrews)
  const pending = listPendingClosureTasksForPlanningDate(
    input.tasks,
    input.date,
    activeCrews
  )
  const orderScope = filterProgrammedTasksForPlanningDate(input.tasks, {
    date: input.date,
  })
  const sorted = sortTasksByDispatchRoute(filtered, input.crews)

  assert.deepEqual(
    model.tasks.list.map((task) => task.id),
    list.map((task) => task.id)
  )
  assert.deepEqual(
    model.tasks.sorted.map((task) => task.id),
    sorted.map((task) => task.id)
  )
  assert.deepEqual(
    model.tasks.pendingClosure.map((task) => task.id),
    pending.map((task) => task.id)
  )
  assert.deepEqual(
    model.tasks.planningOrderScope.map((task) => task.id),
    orderScope.map((task) => task.id)
  )
  assert.equal(model.metrics.crewSummaries.length, summaries.length)
  assert.equal(
    model.metrics.crewSummaries[0].taskCount,
    summaries[0].taskCount
  )
  assert.equal(
    model.metrics.dispatchMode,
    model.metrics.isConfirmedMode ? "confirmed" : "editing"
  )
  // confirmed filter path still available and consistent when forced
  const confirmed = filterConfirmedDispatchTasksForPlanning(input.tasks, {
    date: input.date,
  })
  assert.ok(Array.isArray(confirmed))
})

test("Sprint 19: cache reuses identical fingerprint", () => {
  clearPlanningReadCache()
  const input = sampleInput()
  const key = buildPlanningReadCacheKey(input)

  let builds = 0
  const first = getOrBuildPlanningReadModel(key, () => {
    builds += 1
    return buildPlanningReadModel(input)
  })
  const second = getOrBuildPlanningReadModel(key, () => {
    builds += 1
    return buildPlanningReadModel(input)
  })

  assert.equal(builds, 1)
  assert.equal(first, second)
  assert.equal(getPlanningReadCacheSize(), 1)
  assert.equal(getCachedPlanningReadModel(key)?.tasks.list[0]?.id, "t1")
})

test("Sprint 19: cache miss after staleTime", () => {
  clearPlanningReadCache()
  const input = sampleInput()
  const key = buildPlanningReadCacheKey(input)
  const now = Date.now()
  setCachedPlanningReadModel(key, buildPlanningReadModel(input, now), now)

  assert.equal(
    getCachedPlanningReadModel(
      key,
      now + PLANNING_READ_STALE_TIME_MS + 1
    ),
    null
  )
})

test("Sprint 19: React Query key + defaults reuse existing client policy", async () => {
  assert.equal(PLANNING_READ_STALE_TIME_MS, 60_000)
  assert.equal(PLANNING_READ_GC_TIME_MS, 10 * 60_000)
  assert.equal(PLANNING_READ_QUERY_DEFAULTS.refetchOnWindowFocus, false)
  assert.equal(PLANNING_READ_QUERY_DEFAULTS.refetchOnMount, false)

  const key = planningQueryKeys.readModel("abc")
  assert.deepEqual(key, ["planning", "read-model", "abc"])

  const client = new QueryClient({
    defaultOptions: { queries: { ...PLANNING_READ_QUERY_DEFAULTS } },
  })
  try {
    let builds = 0
    const model = await client.fetchQuery({
      queryKey: key,
      queryFn: () => {
        builds += 1
        return buildPlanningReadModel(sampleInput())
      },
      ...PLANNING_READ_QUERY_DEFAULTS,
    })
    const again = await client.fetchQuery({
      queryKey: key,
      queryFn: () => {
        builds += 1
        return buildPlanningReadModel(sampleInput())
      },
      ...PLANNING_READ_QUERY_DEFAULTS,
    })

    assert.equal(builds, 1)
    assert.equal(again.date, model.date)
  } finally {
    client.clear()
  }
})

test("Sprint 19: cache key changes when filters change", () => {
  const a = buildPlanningReadCacheKey(sampleInput({ crewFilterId: null }))
  const b = buildPlanningReadCacheKey(sampleInput({ crewFilterId: "c1" }))
  assert.notEqual(a, b)
})
