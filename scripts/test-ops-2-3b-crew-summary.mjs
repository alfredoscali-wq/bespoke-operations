import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateCrewCapacity,
} from "../lib/engines/planning/services/CapacityService.ts"
import {
  buildCrewPlanningSummary,
  formatTravelDistanceKm,
} from "../lib/engines/planning/services/SummaryService.ts"
import { validateCrewPlanning } from "../lib/engines/planning/services/ValidationService.ts"

const crew = {
  id: "crew-a",
  name: "Norte",
  operationalBaseName: "Base Córdoba",
  operationalBaseAddress: null,
  operationalBaseLatitude: -31.42,
  operationalBaseLongitude: -64.18,
  habitualShiftMinutes: 480,
}

function makeTask(input) {
  return {
    id: input.id,
    companyId: "c1",
    code: input.code,
    title: input.code,
    status: "programada",
    priority: "media",
    dueDate: "2026-07-25",
    estimatedDuration: `${input.durationMin} min`,
    progress: 0,
    crewId: "crew-a",
    crew: "Norte",
    executionOrder: input.executionOrder,
    latitude: input.latitude ?? -31.43,
    longitude: input.longitude ?? -64.19,
    taskMetadata: {
      ...(input.travel != null
        ? { travel_from_previous_minutes: input.travel }
        : {}),
      ...(input.travelDistance != null
        ? { travel_from_previous_distance_meters: input.travelDistance }
        : {}),
      ...(input.returnToBase != null
        ? { return_to_base_minutes: input.returnToBase }
        : {}),
      ...(input.returnDistance != null
        ? { return_to_base_distance_meters: input.returnDistance }
        : {}),
      ...(input.extraMetadata ?? {}),
    },
  }
}

test("OPS 2.3B: formatTravelDistanceKm un decimal", () => {
  assert.equal(formatTravelDistanceKm(48_300), "48,3 km")
  assert.equal(formatTravelDistanceKm(0), "0,0 km")
  assert.equal(formatTravelDistanceKm(1_050), "1,1 km")
})

test("OPS 2.3B: CapacityService calcula ocupación y distancia", () => {
  const tasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      durationMin: 120,
      travel: 30,
      travelDistance: 12_000,
    }),
    makeTask({
      id: "b",
      code: "OT-B",
      executionOrder: 2,
      durationMin: 90,
      travel: 20,
      travelDistance: 8_000,
      returnToBase: 25,
      returnDistance: 10_000,
    }),
  ]

  const capacity = calculateCrewCapacity({
    tasks,
    crew,
    crews: [crew],
    availableMinutes: 480,
  })

  assert.equal(capacity.taskCount, 2)
  assert.equal(capacity.technicalMinutes, 210)
  assert.equal(capacity.travelMinutes, 75)
  assert.equal(capacity.totalMinutes, 285)
  assert.equal(capacity.travelDistanceMeters, 30_000)
  assert.equal(capacity.occupancyPercent, Math.round((285 / 480) * 100))
  assert.equal(capacity.status, "normal")
})

test("OPS 2.3B: estados Normal / Alta carga / Sobrecargada / Vacío", () => {
  const empty = calculateCrewCapacity({
    tasks: [],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.equal(empty.status, "empty")

  const normal = calculateCrewCapacity({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 200,
        travel: 20,
        returnToBase: 20,
      }),
    ],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.equal(normal.status, "normal")
  assert.ok(normal.occupancyPercent < 85)

  const high = calculateCrewCapacity({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 400,
        travel: 20,
        returnToBase: 10,
      }),
    ],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.equal(high.status, "high_load")
  assert.ok(high.occupancyPercent >= 85)
  assert.ok(high.occupancyPercent <= 100)

  const overloaded = calculateCrewCapacity({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 500,
        travel: 20,
        returnToBase: 20,
      }),
    ],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.equal(overloaded.status, "overloaded")
})

test("OPS 2.3B: SummaryService arma recomendación y labels", () => {
  const summary = buildCrewPlanningSummary({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 100,
        travel: 10,
        travelDistance: 5_000,
        returnToBase: 10,
        returnDistance: 4_000,
      }),
    ],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })

  assert.equal(summary.crewName, "Norte")
  assert.equal(summary.operationalBaseName, "Base Córdoba")
  assert.equal(summary.status, "normal")
  assert.equal(summary.statusLabel, "🟢 Normal")
  assert.equal(
    summary.recommendation,
    "La cuadrilla tiene capacidad disponible para nuevas tareas."
  )
  assert.equal(summary.travelDistanceLabel, "9,0 km")
  assert.equal(summary.configureBaseHref, "/cuadrillas/crew-a")
  assert.equal(summary.baseGpsAvailable, true)
})

test("OPS 2.3B: ValidationService warnings no bloqueantes", () => {
  const crewNoGps = {
    ...crew,
    operationalBaseLatitude: null,
    operationalBaseLongitude: null,
  }

  const capacity = calculateCrewCapacity({
    tasks: [],
    crew: crewNoGps,
    crews: [crewNoGps],
    availableMinutes: 480,
  })

  const warnings = validateCrewPlanning({
    tasks: [],
    crew: crewNoGps,
    crews: [crewNoGps],
    capacity,
  })

  assert.ok(warnings.some((entry) => entry.code === "MISSING_BASE_GPS"))
  assert.ok(warnings.some((entry) => entry.code === "NO_TASKS"))

  const overloadedTasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      durationMin: 500,
      travel: 50,
      returnToBase: 50,
    }),
  ]
  const overloadedCapacity = calculateCrewCapacity({
    tasks: overloadedTasks,
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.equal(overloadedCapacity.status, "overloaded")
  assert.ok(
    validateCrewPlanning({
      tasks: overloadedTasks,
      crew,
      crews: [crew],
      capacity: overloadedCapacity,
    }).some((entry) => entry.code === "JOURNEY_EXCEEDED")
  )

  const missingGpsTask = makeTask({
    id: "b",
    code: "OT-B",
    executionOrder: 1,
    durationMin: 60,
  })
  missingGpsTask.latitude = undefined
  missingGpsTask.longitude = undefined
  const missingGpsCapacity = calculateCrewCapacity({
    tasks: [missingGpsTask],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.ok(
    validateCrewPlanning({
      tasks: [missingGpsTask],
      crew,
      crews: [crew],
      capacity: missingGpsCapacity,
    }).some((entry) => entry.code === "TASK_MISSING_GPS")
  )

  const negativeTravelTask = makeTask({
    id: "c",
    code: "OT-C",
    executionOrder: 1,
    durationMin: 60,
  })
  negativeTravelTask.taskMetadata.travel_from_previous_minutes = -5
  const negativeCapacity = calculateCrewCapacity({
    tasks: [negativeTravelTask],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.ok(
    validateCrewPlanning({
      tasks: [negativeTravelTask],
      crew,
      crews: [crew],
      capacity: negativeCapacity,
    }).some((entry) => entry.code === "NEGATIVE_TRAVEL")
  )

  const badDurationTask = makeTask({
    id: "d",
    code: "OT-D",
    executionOrder: 1,
    durationMin: 60,
  })
  badDurationTask.estimatedDuration = "abc"
  const badDurationCapacity = calculateCrewCapacity({
    tasks: [badDurationTask],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.ok(
    validateCrewPlanning({
      tasks: [badDurationTask],
      crew,
      crews: [crew],
      capacity: badDurationCapacity,
    }).some((entry) => entry.code === "INCONSISTENT_DURATION")
  )
})

test("OPS 2.3B: Summary sobrecargada recomienda redistribuir", () => {
  const summary = buildCrewPlanningSummary({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 500,
        travel: 30,
        returnToBase: 30,
      }),
    ],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })
  assert.equal(summary.status, "overloaded")
  assert.equal(
    summary.recommendation,
    "Se recomienda redistribuir tareas entre cuadrillas."
  )
})
