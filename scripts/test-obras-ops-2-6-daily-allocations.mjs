/**
 * OPS 2.6 — daily allocations for multi-day Obra OTs.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAutomaticDailyAllocations,
  DAILY_ALLOCATION_SUM_MISMATCH_MESSAGE,
  formatDailyAllocationHistoryNote,
  isMultiDayOperationalRange,
  listWorkDatesInRange,
  resolveMinutesForWorkDate,
  validateManualDailyAllocations,
} from "../lib/projects/task-daily-allocations.ts"
import { resolvePlanningDayDurationMinutes } from "../lib/planificacion/planning-date-range.ts"

test("OPS 2.6A: crear OT multi-día automática (even split)", () => {
  const rows = buildAutomaticDailyAllocations("2026-08-09", "2026-08-10", 540)
  assert.equal(isMultiDayOperationalRange("2026-08-09", "2026-08-10"), true)
  assert.deepEqual(rows, [
    { workDate: "2026-08-09", allocatedMinutes: 270 },
    { workDate: "2026-08-10", allocatedMinutes: 270 },
  ])

  const task = {
    startDate: "2026-08-09",
    dueDate: "2026-08-10",
    estimatedDuration: "540",
  }
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-09"), 270)
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-10"), 270)
})

test("OPS 2.6B: crear OT multi-día manual", () => {
  const allocations = [
    { workDate: "2026-08-09", allocatedMinutes: 420 },
    { workDate: "2026-08-10", allocatedMinutes: 120 },
  ]
  const validation = validateManualDailyAllocations({
    startDate: "2026-08-09",
    dueDate: "2026-08-10",
    totalMinutes: 540,
    allocations,
  })
  assert.equal(validation.ok, true)
})

test("OPS 2.6C: validación suma incorrecta", () => {
  const validation = validateManualDailyAllocations({
    startDate: "2026-08-09",
    dueDate: "2026-08-10",
    totalMinutes: 540,
    allocations: [
      { workDate: "2026-08-09", allocatedMinutes: 400 },
      { workDate: "2026-08-10", allocatedMinutes: 100 },
    ],
  })
  assert.equal(validation.ok, false)
  if (!validation.ok) {
    assert.equal(validation.message, DAILY_ALLOCATION_SUM_MISMATCH_MESSAGE)
  }

  assert.equal(
    validateManualDailyAllocations({
      startDate: "2026-08-09",
      dueDate: "2026-08-10",
      totalMinutes: 540,
      allocations: [
        { workDate: "2026-08-09", allocatedMinutes: 0 },
        { workDate: "2026-08-10", allocatedMinutes: 540 },
      ],
    }).ok,
    false
  )

  assert.equal(
    validateManualDailyAllocations({
      startDate: "2026-08-09",
      dueDate: "2026-08-10",
      totalMinutes: 540,
      allocations: [
        { workDate: "2026-08-08", allocatedMinutes: 270 },
        { workDate: "2026-08-10", allocatedMinutes: 270 },
      ],
    }).ok,
    false
  )
})

test("OPS 2.6D: editar distribución + historial", () => {
  const before = [
    { workDate: "2026-08-09", allocatedMinutes: 270 },
    { workDate: "2026-08-10", allocatedMinutes: 270 },
  ]
  const after = [
    { workDate: "2026-08-09", allocatedMinutes: 420 },
    { workDate: "2026-08-10", allocatedMinutes: 120 },
  ]
  const note = formatDailyAllocationHistoryNote(before, after, {
    actor: "Supervisor",
  })
  assert.ok(note)
  assert.match(note, /Distribución diaria/)
  assert.match(note, /270 → 420/)
  assert.match(note, /270 → 120/)
})

test("OPS 2.6E: capacidad usa allocations", () => {
  const task = {
    startDate: "2026-08-09",
    dueDate: "2026-08-10",
    estimatedDuration: "540",
    dailyAllocations: [
      { workDate: "2026-08-09", allocatedMinutes: 420 },
      { workDate: "2026-08-10", allocatedMinutes: 120 },
    ],
  }
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-09"), 420)
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-10"), 120)
  assert.equal(resolveMinutesForWorkDate(task.dailyAllocations, "2026-08-09"), 420)
})

test("OPS 2.6F: fallback legacy sin allocations", () => {
  const task = {
    startDate: "2026-08-09",
    dueDate: "2026-08-10",
    estimatedDuration: "540 min",
  }
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-09"), 270)
  assert.equal(resolvePlanningDayDurationMinutes(task, "2026-08-10"), 270)
  assert.equal(resolveMinutesForWorkDate(undefined, "2026-08-09"), null)
  assert.equal(listWorkDatesInRange("2026-08-09", "2026-08-09").length, 1)
  assert.equal(
    resolvePlanningDayDurationMinutes(
      { startDate: "2026-08-09", dueDate: "2026-08-09", estimatedDuration: "540" },
      "2026-08-09"
    ),
    540
  )
})
