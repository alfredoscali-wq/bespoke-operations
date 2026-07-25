import assert from "node:assert/strict"
import test from "node:test"

import {
  applyDayOperationalBaseToCrew,
  resolvePlanningDayOperationalConfig,
} from "../lib/planificacion/planning-day-config.ts"
import { buildCrewJourneySegments } from "../lib/engines/planning/services/recalculate-journey-travel.ts"
import { buildCrewPlanningSummary } from "../lib/engines/planning/services/SummaryService.ts"
import { calculateCrewCapacity } from "../lib/engines/planning/services/CapacityService.ts"

const crew = {
  id: "crew-a",
  name: "Norte",
  operationalBaseName: "Depósito Norte",
  operationalBaseAddress: "Av. Colón 1000",
  operationalBaseLatitude: -31.42,
  operationalBaseLongitude: -64.18,
  habitualStartTime: "08:00:00",
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
    latitude: input.latitude,
    longitude: input.longitude,
    taskMetadata: {
      ...(input.travel != null
        ? { travel_from_previous_minutes: input.travel }
        : {}),
      ...(input.returnToBase != null
        ? { return_to_base_minutes: input.returnToBase }
        : {}),
    },
  }
}

test("OPS 2.3C: jornada completa incluye Base→OT y OT→Base", () => {
  const tasks = [
    makeTask({
      id: "a",
      code: "OT-A",
      executionOrder: 1,
      durationMin: 60,
      latitude: -31.43,
      longitude: -64.19,
    }),
    makeTask({
      id: "b",
      code: "OT-B",
      executionOrder: 2,
      durationMin: 60,
      latitude: -31.44,
      longitude: -64.2,
    }),
  ]

  const built = buildCrewJourneySegments({
    tasks,
    crew,
    crews: [crew],
  })

  assert.equal(built.baseGpsAvailable, true)
  assert.equal(built.plans.length, 3)
  assert.equal(built.plans[0].segment.origin.latitude, crew.operationalBaseLatitude)
  assert.equal(built.plans[0].segment.destination.latitude, -31.43)
  assert.equal(built.plans[2].segment.kind, "return_to_base")
  assert.equal(
    built.plans[2].segment.destination.latitude,
    crew.operationalBaseLatitude
  )
})

test("OPS 2.3C: override diario cambia Base GPS efectiva", () => {
  const dayConfig = resolvePlanningDayOperationalConfig({
    crew,
    override: {
      useHabitual: false,
      operationalBaseName: "Base Villa Allende",
      operationalBaseAddress: "Villa Allende",
      operationalBaseLatitude: -31.3,
      operationalBaseLongitude: -64.3,
      startTime: "09:00",
      availableMinutes: 420,
    },
  })

  assert.equal(dayConfig.source, "override")
  assert.equal(dayConfig.operationalBaseName, "Base Villa Allende")
  assert.ok(dayConfig.operationalBase)
  assert.equal(dayConfig.operationalBase?.latitude, -31.3)
  assert.equal(dayConfig.operationalBase?.longitude, -64.3)

  const effective = applyDayOperationalBaseToCrew(crew, dayConfig)
  assert.equal(effective.operationalBaseName, "Base Villa Allende")
  assert.equal(effective.operationalBaseLatitude, -31.3)

  const built = buildCrewJourneySegments({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 60,
        latitude: -31.43,
        longitude: -64.19,
      }),
    ],
    crew: effective,
    crews: [crew],
  })

  assert.equal(built.plans[0].segment.origin.latitude, -31.3)
  assert.equal(built.plans[1].segment.destination.latitude, -31.3)
})

test("OPS 2.3C: Summary expone Salida y Regreso", () => {
  const summary = buildCrewPlanningSummary({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 100,
        latitude: -31.43,
        longitude: -64.19,
        travel: 8,
        returnToBase: 11,
      }),
    ],
    crew,
    crews: [crew],
    availableMinutes: 480,
  })

  assert.equal(summary.operationalBaseName, "Depósito Norte")
  assert.equal(summary.operationalBaseAddress, "Av. Colón 1000")
  assert.equal(summary.departureMinutes, 8)
  assert.equal(summary.returnMinutes, 11)
  assert.equal(summary.travelMinutes, 19)
  assert.equal(summary.baseGpsAvailable, true)
})

test("OPS 2.3C: sin GPS de Base omite salida/regreso", () => {
  const noGps = {
    ...crew,
    operationalBaseLatitude: null,
    operationalBaseLongitude: null,
  }
  const capacity = calculateCrewCapacity({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 60,
        latitude: -31.43,
        longitude: -64.19,
        travel: 5,
      }),
      makeTask({
        id: "b",
        code: "OT-B",
        executionOrder: 2,
        durationMin: 60,
        latitude: -31.44,
        longitude: -64.2,
        travel: 12,
      }),
    ],
    crew: noGps,
    crews: [noGps],
    availableMinutes: 480,
  })

  const built = buildCrewJourneySegments({
    tasks: [
      makeTask({
        id: "a",
        code: "OT-A",
        executionOrder: 1,
        durationMin: 60,
        latitude: -31.43,
        longitude: -64.19,
      }),
      makeTask({
        id: "b",
        code: "OT-B",
        executionOrder: 2,
        durationMin: 60,
        latitude: -31.44,
        longitude: -64.2,
      }),
    ],
    crew: noGps,
    crews: [noGps],
  })

  assert.equal(built.baseGpsAvailable, false)
  assert.equal(built.plans.length, 1)
  assert.equal(built.plans[0].segment.id, "to-task:b")
  assert.equal(capacity.travelMinutes, 17)
})
