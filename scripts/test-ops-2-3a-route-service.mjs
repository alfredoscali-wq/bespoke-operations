import assert from "node:assert/strict"
import test from "node:test"

import {
  MemoryRouteCache,
  buildRouteCacheKey,
} from "../lib/engines/planning/cache/MemoryRouteCache.ts"
import {
  buildTravelEndpointsKey,
  planningRepository,
} from "../lib/engines/planning/repositories/PlanningRepository.ts"
import { OpenRouteServiceProvider } from "../lib/engines/planning/providers/OpenRouteServiceProvider.ts"
import {
  RouteService,
  resetSharedRouteServiceForTests,
} from "../lib/engines/planning/services/RouteService.ts"
import {
  buildCrewJourneySegments,
  listAffectedSegmentIds,
  MISSING_BASE_GPS_WARNING,
} from "../lib/engines/planning/services/recalculate-journey-travel.ts"
import { recalculateCrewJourneyTravel } from "../lib/engines/planning/services/recalculate-crew-journey.ts"

const BASE = { latitude: -31.42, longitude: -64.18 }
const OT_A = { latitude: -31.43, longitude: -64.19 }
const OT_B = { latitude: -31.44, longitude: -64.2 }
const OT_C = { latitude: -31.45, longitude: -64.21 }

function makeCrew() {
  return {
    id: "crew-a",
    name: "Norte",
    operationalBaseName: "Base Córdoba",
    operationalBaseLatitude: BASE.latitude,
    operationalBaseLongitude: BASE.longitude,
  }
}

function makeTask(input) {
  return {
    id: input.id,
    companyId: "c1",
    code: input.code,
    title: input.code,
    status: "programada",
    priority: "media",
    dueDate: "2026-07-21",
    estimatedDuration: "60 min",
    progress: 0,
    crewId: "crew-a",
    crew: "Norte",
    executionOrder: input.executionOrder,
    latitude: input.latitude,
    longitude: input.longitude,
    taskMetadata: input.taskMetadata ?? {},
  }
}

function mockProvider(handler) {
  return {
    name: "openrouteservice",
    getRoute: async (request) => handler(request),
  }
}

function okResult(minutes, distanceMeters, overrides = {}) {
  return {
    minutes,
    distanceMeters,
    provider: "openrouteservice",
    status: "ok",
    cacheHit: false,
    responseTimeMs: overrides.responseTimeMs ?? 12,
    ...overrides,
  }
}

test("OPS 2.3A: cálculo correcto vía RouteService", async () => {
  resetSharedRouteServiceForTests()
  const cache = new MemoryRouteCache()
  const service = new RouteService({
    cache,
    provider: mockProvider(async () => okResult(27, 5400)),
  })

  const result = await service.getRoute({
    origin: BASE,
    destination: OT_A,
  })

  assert.equal(result.status, "ok")
  assert.equal(result.minutes, 27)
  assert.equal(result.distanceMeters, 5400)
  assert.equal(result.provider, "openrouteservice")
  assert.equal(result.cacheHit, false)
})

test("OPS 2.3A: cache miss luego cache hit", async () => {
  resetSharedRouteServiceForTests()
  let calls = 0
  const cache = new MemoryRouteCache()
  const service = new RouteService({
    cache,
    provider: mockProvider(async () => {
      calls += 1
      return okResult(15, 2100)
    }),
  })

  const first = await service.getRoute({ origin: BASE, destination: OT_A })
  const second = await service.getRoute({ origin: BASE, destination: OT_A })

  assert.equal(calls, 1)
  assert.equal(first.cacheHit, false)
  assert.equal(second.cacheHit, true)
  assert.equal(second.minutes, 15)
  assert.ok(buildRouteCacheKey(BASE, OT_A).includes(String(BASE.latitude)))
})

test("OPS 2.3A: timeout del provider no bloquea", async () => {
  resetSharedRouteServiceForTests()
  const service = new RouteService({
    cache: new MemoryRouteCache(),
    provider: mockProvider(async () => ({
      minutes: 0,
      distanceMeters: 0,
      provider: "openrouteservice",
      status: "timeout",
      cacheHit: false,
      responseTimeMs: 8000,
      message: "aborted",
    })),
  })

  const result = await service.getRoute({ origin: BASE, destination: OT_A })
  assert.equal(result.status, "timeout")
  assert.equal(result.minutes, 0)
})

test("OPS 2.3A: error del provider no bloquea", async () => {
  resetSharedRouteServiceForTests()
  const service = new RouteService({
    cache: new MemoryRouteCache(),
    provider: mockProvider(async () => ({
      minutes: 0,
      distanceMeters: 0,
      provider: "openrouteservice",
      status: "error",
      cacheHit: false,
      responseTimeMs: 40,
      message: "HTTP 500",
    })),
  })

  const result = await service.getRoute({ origin: BASE, destination: OT_A })
  assert.equal(result.status, "error")
})

test("OPS 2.3A: OpenRouteServiceProvider transforma respuesta y timeout", async () => {
  const okFetch = async () =>
    new Response(
      JSON.stringify({
        routes: [{ summary: { duration: 600, distance: 3200 } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  const provider = new OpenRouteServiceProvider({
    apiKey: "test-key",
    fetchImpl: okFetch,
  })
  const ok = await provider.getRoute({ origin: BASE, destination: OT_A })
  assert.equal(ok.status, "ok")
  assert.equal(ok.minutes, 10)
  assert.equal(ok.distanceMeters, 3200)
  assert.equal("routes" in ok, false)

  const timeoutFetch = async (_url, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("The operation was aborted")
        error.name = "AbortError"
        reject(error)
      })
    })

  const slow = new OpenRouteServiceProvider({
    apiKey: "test-key",
    timeoutMs: 20,
    fetchImpl: timeoutFetch,
  })
  const timedOut = await slow.getRoute({ origin: BASE, destination: OT_B })
  assert.equal(timedOut.status, "timeout")
})

test("OPS 2.3A: segmentos Base→OT, OT→OT, OT→Base", () => {
  const crew = makeCrew()
  const tasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      latitude: OT_A.latitude,
      longitude: OT_A.longitude,
    }),
    makeTask({
      id: "b",
      code: "OT-B",
      executionOrder: 2,
      latitude: OT_B.latitude,
      longitude: OT_B.longitude,
    }),
    makeTask({
      id: "c",
      code: "OT-C",
      executionOrder: 3,
      latitude: OT_C.latitude,
      longitude: OT_C.longitude,
    }),
  ]

  const built = buildCrewJourneySegments({
    tasks,
    crew,
    crews: [crew],
  })
  const plans = built.plans
  assert.equal(built.baseGpsAvailable, true)
  assert.equal(built.warning, null)
  assert.equal(plans.length, 4)

  assert.equal(plans[0].segment.kind, "to_task")
  assert.equal(plans[0].segment.ownerTaskId, "a")
  assert.deepEqual(plans[0].segment.origin, BASE)
  assert.deepEqual(plans[0].segment.destination, OT_A)

  assert.equal(plans[1].segment.kind, "to_task")
  assert.equal(plans[1].segment.ownerTaskId, "b")
  assert.deepEqual(plans[1].segment.origin, OT_A)
  assert.deepEqual(plans[1].segment.destination, OT_B)

  assert.equal(plans[2].segment.kind, "to_task")
  assert.equal(plans[2].segment.ownerTaskId, "c")
  assert.deepEqual(plans[2].segment.origin, OT_B)
  assert.deepEqual(plans[2].segment.destination, OT_C)

  assert.equal(plans[3].segment.kind, "return_to_base")
  assert.equal(plans[3].segment.ownerTaskId, "c")
  assert.deepEqual(plans[3].segment.origin, OT_C)
  assert.deepEqual(plans[3].segment.destination, BASE)
})

test("OPS 2.3A: override MANUAL se respeta mientras no cambien extremos", async () => {
  resetSharedRouteServiceForTests()
  let calls = 0
  const crew = makeCrew()
  const endpoints = buildTravelEndpointsKey(BASE, OT_A)
  const tasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      latitude: OT_A.latitude,
      longitude: OT_A.longitude,
      taskMetadata: planningRepository.mergeTravelFromPrevious(
        {},
        {
          minutes: 99,
          distanceMeters: 1000,
          source: "MANUAL",
          origin: BASE,
          destination: OT_A,
        }
      ),
    }),
  ]

  assert.equal(
    planningRepository.readTravelFromPrevious(tasks[0].taskMetadata).endpointsKey,
    endpoints
  )

  const result = await recalculateCrewJourneyTravel({
    tasks,
    crew,
    crews: [crew],
    routeService: new RouteService({
      cache: new MemoryRouteCache(),
      provider: mockProvider(async () => {
        calls += 1
        return okResult(10, 500)
      }),
    }),
  })

  assert.equal(result.ok, true)
  assert.equal(result.recalculatedCount, 1) // return_to_base still needs calc
  assert.equal(calls, 1)
  const travelUpdate = result.updates.find((entry) => entry.taskId === "a")
  assert.ok(travelUpdate)
  assert.equal(
    planningRepository.readTravelFromPrevious(travelUpdate.taskMetadata).minutes,
    99
  )
  assert.equal(
    planningRepository.readTravelFromPrevious(travelUpdate.taskMetadata).source,
    "MANUAL"
  )
})

test("OPS 2.3A: invalidación de override al cambiar extremos", async () => {
  resetSharedRouteServiceForTests()
  const crew = makeCrew()
  const tasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      latitude: OT_A.latitude,
      longitude: OT_A.longitude,
      taskMetadata: planningRepository.mergeTravelFromPrevious(
        {},
        {
          minutes: 99,
          distanceMeters: 1000,
          source: "MANUAL",
          origin: BASE,
          destination: OT_B, // stale endpoints → must invalidate
        }
      ),
    }),
  ]

  const result = await recalculateCrewJourneyTravel({
    tasks,
    crew,
    crews: [crew],
    routeService: new RouteService({
      cache: new MemoryRouteCache(),
      provider: mockProvider(async () => okResult(22, 3300)),
    }),
  })

  assert.equal(result.ok, true)
  const travelUpdate = result.updates.find((entry) => entry.taskId === "a")
  const leg = planningRepository.readTravelFromPrevious(travelUpdate.taskMetadata)
  assert.equal(leg.minutes, 22)
  assert.equal(leg.source, "AUTOMATIC")
  assert.equal(leg.endpointsKey, buildTravelEndpointsKey(BASE, OT_A))
})

test("OPS 2.3A: recálculo parcial al eliminar OT intermedia", () => {
  const crew = makeCrew()
  const beforeTasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      latitude: OT_A.latitude,
      longitude: OT_A.longitude,
    }),
    makeTask({
      id: "b",
      code: "OT-B",
      executionOrder: 2,
      latitude: OT_B.latitude,
      longitude: OT_B.longitude,
    }),
    makeTask({
      id: "c",
      code: "OT-C",
      executionOrder: 3,
      latitude: OT_C.latitude,
      longitude: OT_C.longitude,
    }),
  ]
  const afterTasks = beforeTasks.filter((task) => task.id !== "b")

  const previous = buildCrewJourneySegments({
    tasks: beforeTasks,
    crew,
    crews: [crew],
  }).plans
  const next = buildCrewJourneySegments({
    tasks: afterTasks,
    crew,
    crews: [crew],
  }).plans

  const affected = listAffectedSegmentIds(previous, next)

  // A→B and B→C disappear; A→C appears; return may move from C stays but endpoints same
  assert.ok(affected.includes("to-task:b"))
  assert.ok(affected.includes("to-task:c"))
  assert.equal(
    next.find((plan) => plan.segment.id === "to-task:c")?.endpointsKey,
    buildTravelEndpointsKey(OT_A, OT_C)
  )
  assert.equal(
    previous.find((plan) => plan.segment.id === "to-task:a")?.endpointsKey,
    next.find((plan) => plan.segment.id === "to-task:a")?.endpointsKey
  )
})

test("OPS 2.3A: fallo de provider deja planificación usable", async () => {
  resetSharedRouteServiceForTests()
  const crew = makeCrew()
  const tasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      latitude: OT_A.latitude,
      longitude: OT_A.longitude,
    }),
  ]

  const result = await recalculateCrewJourneyTravel({
    tasks,
    crew,
    crews: [crew],
    routeService: new RouteService({
      cache: new MemoryRouteCache(),
      provider: mockProvider(async () => ({
        minutes: 0,
        distanceMeters: 0,
        provider: "openrouteservice",
        status: "rate_limited",
        cacheHit: false,
        responseTimeMs: 5,
        message: "429",
      })),
    }),
  })

  assert.equal(result.ok, true)
  assert.equal(result.failedCount, 2)
  assert.equal(result.recalculatedCount, 0)
})

test("OPS 2.3A.1: sin GPS de Base omite Base↔OT y calcula OT→OT", async () => {
  resetSharedRouteServiceForTests()
  const crew = {
    id: "crew-a",
    name: "Norte",
    operationalBaseName: "Base sin GPS",
    operationalBaseLatitude: null,
    operationalBaseLongitude: null,
  }
  const tasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      latitude: OT_A.latitude,
      longitude: OT_A.longitude,
    }),
    makeTask({
      id: "b",
      code: "OT-B",
      executionOrder: 2,
      latitude: OT_B.latitude,
      longitude: OT_B.longitude,
    }),
    makeTask({
      id: "c",
      code: "OT-C",
      executionOrder: 3,
      latitude: OT_C.latitude,
      longitude: OT_C.longitude,
    }),
  ]

  const built = buildCrewJourneySegments({
    tasks,
    crew,
    crews: [crew],
  })
  assert.equal(built.baseGpsAvailable, false)
  assert.equal(built.warning, MISSING_BASE_GPS_WARNING)
  assert.equal(built.plans.length, 2)
  assert.equal(built.plans[0].segment.id, "to-task:b")
  assert.deepEqual(built.plans[0].segment.origin, OT_A)
  assert.deepEqual(built.plans[0].segment.destination, OT_B)
  assert.equal(built.plans[1].segment.id, "to-task:c")
  assert.ok(!built.plans.some((plan) => plan.segment.kind === "return_to_base"))

  let calls = 0
  const result = await recalculateCrewJourneyTravel({
    tasks,
    crew,
    crews: [crew],
    routeService: new RouteService({
      cache: new MemoryRouteCache(),
      provider: mockProvider(async () => {
        calls += 1
        return okResult(12, 1800)
      }),
    }),
  })

  assert.equal(result.ok, true)
  assert.equal(result.warning, MISSING_BASE_GPS_WARNING)
  assert.equal(result.baseGpsAvailable, false)
  assert.equal(result.recalculatedCount, 2)
  assert.equal(calls, 2)
})

test("OPS 2.3A.1: guardado MANUAL sin GPS de Base no requiere extremos", () => {
  const travel = planningRepository.mergeTravelFromPreviousMinutesOnly(
    { travel_from_previous_minutes: 5 },
    { minutes: 18 }
  )
  const leg = planningRepository.readTravelFromPrevious(travel)
  assert.equal(leg.minutes, 18)
  assert.equal(leg.source, "MANUAL")
  assert.equal(leg.endpointsKey, null)

  const ret = planningRepository.mergeReturnToBaseMinutesOnly(
    {},
    { minutes: 25 }
  )
  const returnLeg = planningRepository.readReturnToBase(ret)
  assert.equal(returnLeg.minutes, 25)
  assert.equal(returnLeg.source, "MANUAL")
  assert.equal(returnLeg.endpointsKey, null)
})
