import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveCrewHabitualShiftMinutes,
  resolveCrewOperationalBase,
  validateCrewOperationalConfigInput,
} from "../lib/crews/operational-config.ts"
import {
  resolvePlanningDayOperationalConfig,
} from "../lib/planificacion/planning-day-config.ts"
import { calculatePlanningSummary } from "../lib/planificacion/planning-summary.ts"
import { PLANNING_DEFAULT_AVAILABLE_MINUTES } from "../lib/planificacion/planning-duration.ts"

const crew = {
  id: "crew-a",
  name: "Norte",
  operationalBaseName: "Córdoba Capital",
  operationalBaseLatitude: -31.42,
  operationalBaseLongitude: -64.18,
  habitualStartTime: "08:00:00",
  habitualShiftMinutes: 480,
}

test("OPS 2.2: resolve operational base requires name + GPS", () => {
  const base = resolveCrewOperationalBase(crew)
  assert.ok(base)
  assert.equal(base?.name, "Córdoba Capital")
  assert.equal(resolveCrewOperationalBase({
    operationalBaseName: "Sin GPS",
    operationalBaseLatitude: null,
    operationalBaseLongitude: null,
  }), null)
})

test("OPS 2.2: validación base sin coordenadas", () => {
  const result = validateCrewOperationalConfigInput({
    operationalBaseName: "Córdoba Capital",
    operationalBaseLatitude: null,
    operationalBaseLongitude: null,
  })
  assert.equal(result.ok, false)

  const ok = validateCrewOperationalConfigInput({
    operationalBaseName: "Córdoba Capital",
    operationalBaseLatitude: -31.42,
    operationalBaseLongitude: -64.18,
    habitualShiftMinutes: 480,
    habitualStartTime: "08:00",
  })
  assert.equal(ok.ok, true)

  const badDuration = validateCrewOperationalConfigInput({
    habitualShiftMinutes: 0,
  })
  assert.equal(badDuration.ok, false)
})

test("OPS 2.2: planning day override no muta habitual permanente", () => {
  const habitual = resolvePlanningDayOperationalConfig({
    crew,
    override: null,
  })
  assert.equal(habitual.useHabitual, true)
  assert.equal(habitual.availableMinutes, 480)
  assert.equal(habitual.startTime, "08:00")
  assert.equal(habitual.source, "habitual")

  const overridden = resolvePlanningDayOperationalConfig({
    crew,
    override: {
      useHabitual: false,
      operationalBaseName: "Base temporal",
      startTime: "09:30",
      availableMinutes: 420,
    },
  })
  assert.equal(overridden.useHabitual, false)
  assert.equal(overridden.operationalBaseName, "Base temporal")
  assert.equal(overridden.startTime, "09:30")
  assert.equal(overridden.availableMinutes, 420)
  assert.equal(overridden.source, "override")
  // GPS always from permanent crew config
  assert.equal(overridden.operationalBase?.name, "Córdoba Capital")
})

test("OPS 2.2: calculatePlanningSummary usa duración habitual de cuadrilla", () => {
  const tasks = [
    {
      id: "1",
      companyId: "c1",
      code: "OT-1",
      title: "OT",
      status: "programada",
      priority: "media",
      dueDate: "2026-07-25",
      estimatedDuration: "500 min",
      progress: 0,
      crewId: "crew-a",
      crew: "Norte",
      executionOrder: 1,
      taskMetadata: {},
    },
  ]

  const summary = calculatePlanningSummary({
    tasks,
    crews: [crew],
    groupByCrew: false,
  })
  assert.equal(summary.availableMinutes, 480)
  assert.equal(summary.overtimeMinutes, 20)
  assert.equal(summary.status, "exceeded")

  const withOverride = calculatePlanningSummary({
    tasks,
    crews: [crew],
    groupByCrew: false,
    availableMinutes: 520,
  })
  assert.equal(withOverride.availableMinutes, 520)
  assert.equal(withOverride.status, "normal")
})

test("OPS 2.2: default habitual minutes", () => {
  assert.equal(
    resolveCrewHabitualShiftMinutes({ habitualShiftMinutes: null }),
    PLANNING_DEFAULT_AVAILABLE_MINUTES
  )
})
