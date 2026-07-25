import assert from "node:assert/strict"
import test from "node:test"

import { calculatePlanningSummary } from "../lib/planificacion/planning-summary.ts"
import {
  buildPlanningJourneyItems,
  mergeTravelFromPreviousMinutes,
  resolveReturnToBaseMinutes,
  resolveTravelFromPreviousMinutes,
  sumTravelMinutesForOrderedTasks,
} from "../lib/planificacion/planning-travel.ts"

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
    crewId: input.crewId,
    crew: "Cuadrilla A",
    executionOrder: input.executionOrder,
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

test("OPS 2.1: travel metadata helpers", () => {
  const task = makeTask({
    id: "1",
    code: "OT-001",
    crewId: "crew-a",
    executionOrder: 1,
    durationMin: 60,
    travel: 35,
  })
  assert.equal(resolveTravelFromPreviousMinutes(task), 35)

  const merged = mergeTravelFromPreviousMinutes(task.taskMetadata, 18)
  assert.equal(merged.travel_from_previous_minutes, 18)
})

test("OPS 2.1: calculatePlanningSummary diferencia técnico y traslados", () => {
  const tasks = [
    makeTask({
      id: "1",
      code: "OT-001",
      crewId: "crew-a",
      executionOrder: 1,
      durationMin: 120,
      travel: 35,
    }),
    makeTask({
      id: "2",
      code: "OT-002",
      crewId: "crew-a",
      executionOrder: 2,
      durationMin: 90,
      travel: 18,
      returnToBase: 30,
    }),
  ]

  const summary = calculatePlanningSummary({
    tasks,
    crews: [{ id: "crew-a", name: "A" }],
    groupByCrew: false,
    availableMinutes: 480,
  })

  assert.equal(summary.taskCount, 2)
  assert.equal(summary.technicalMinutes, 210)
  assert.equal(summary.travelMinutes, 35 + 18 + 30)
  assert.equal(summary.totalMinutes, 210 + 83)
  assert.equal(summary.availableMinutes, 480)
  assert.equal(summary.overtimeMinutes, 0)
  assert.equal(summary.status, "normal")
})

test("OPS 2.1: jornada excedida", () => {
  const tasks = [
    makeTask({
      id: "1",
      code: "OT-001",
      crewId: "crew-a",
      executionOrder: 1,
      durationMin: 400,
      travel: 50,
      returnToBase: 40,
    }),
  ]

  const summary = calculatePlanningSummary({
    tasks,
    crews: [{ id: "crew-a", name: "A" }],
    groupByCrew: false,
    availableMinutes: 480,
  })

  assert.equal(summary.totalMinutes, 490)
  assert.equal(summary.overtimeMinutes, 10)
  assert.equal(summary.status, "exceeded")
})

test("OPS 2.1: al reordenar se reconstruyen labels de traslado", () => {
  const ot1 = makeTask({
    id: "1",
    code: "OT-001",
    crewId: "crew-a",
    executionOrder: 1,
    durationMin: 60,
    travel: 35,
  })
  const ot2 = makeTask({
    id: "2",
    code: "OT-002",
    crewId: "crew-a",
    executionOrder: 2,
    durationMin: 60,
    travel: 18,
  })
  const ot3 = makeTask({
    id: "3",
    code: "OT-003",
    crewId: "crew-a",
    executionOrder: 3,
    durationMin: 60,
    travel: 22,
    returnToBase: 30,
  })

  const before = buildPlanningJourneyItems([ot1, ot2, ot3], [
    { id: "crew-a", name: "A" },
  ])
  const travelBefore = before.filter((item) => item.kind === "travel")
  assert.equal(travelBefore[0]?.fromLabel, "Base")
  assert.equal(travelBefore[0]?.toLabel, "OT-001")
  assert.equal(travelBefore[1]?.fromLabel, "OT-001")
  assert.equal(travelBefore[1]?.toLabel, "OT-002")
  assert.equal(travelBefore[2]?.fromLabel, "OT-002")
  assert.equal(travelBefore[2]?.toLabel, "OT-003")
  assert.equal(travelBefore[3]?.fromLabel, "OT-003")
  assert.equal(travelBefore[3]?.toLabel, "Base")

  // Move OT-003 to second place
  const reordered = [
    { ...ot1, executionOrder: 1 },
    { ...ot3, executionOrder: 2 },
    { ...ot2, executionOrder: 3 },
  ]

  const after = buildPlanningJourneyItems(reordered, [
    { id: "crew-a", name: "A" },
  ])
  const travelAfter = after.filter((item) => item.kind === "travel")
  assert.equal(travelAfter[0]?.toLabel, "OT-001")
  assert.equal(travelAfter[1]?.fromLabel, "OT-001")
  assert.equal(travelAfter[1]?.toLabel, "OT-003")
  assert.equal(travelAfter[1]?.minutes, 22) // minutes stay on OT-003
  assert.equal(travelAfter[2]?.fromLabel, "OT-003")
  assert.equal(travelAfter[2]?.toLabel, "OT-002")
  assert.equal(travelAfter[3]?.fromLabel, "OT-002")
  assert.equal(travelAfter[3]?.toLabel, "Base")
  assert.equal(
    resolveReturnToBaseMinutes(reordered),
    30
  )
  assert.equal(sumTravelMinutesForOrderedTasks(reordered), 35 + 22 + 18 + 30)
})
