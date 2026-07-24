import assert from "node:assert/strict"
import test from "node:test"

import {
  ACTIVITY_QUICK_RANGES,
  buildEmployeeActivitySummary,
  groupEmployeeActivityByDay,
  matchActivityQuickRange,
  resolveActivityQuickRange,
} from "../lib/activity/employee-activity-view.ts"
import { ACTIVITY_ACTIONS } from "../lib/activity/types.ts"

function entry(overrides) {
  return {
    id: overrides.id ?? "1",
    createdAt: overrides.createdAt,
    employeeId: overrides.employeeId ?? "emp-1",
    userName: "Test",
    companyId: "co",
    companyName: "Co",
    areaCode: null,
    areaLabel: "—",
    module: overrides.module ?? "tasks",
    action: overrides.action,
    entityType: "task",
    entityId: null,
    detail: overrides.detail ?? "",
    origin: "web",
    severity: "info",
    correlationId: null,
    metadata: {},
    actorType: "employee",
  }
}

test("quick range today covers local day", () => {
  const reference = new Date(2026, 6, 23, 15, 30, 0)
  const range = resolveActivityQuickRange(ACTIVITY_QUICK_RANGES.TODAY, reference)
  assert.equal(matchActivityQuickRange(range.from, range.to, reference), "today")
})

test("summary counts OT and consultations from loaded events", () => {
  const summary = buildEmployeeActivitySummary([
    entry({
      id: "a",
      createdAt: "2026-07-23T10:00:00.000Z",
      action: ACTIVITY_ACTIONS.TASK_CREATE,
    }),
    entry({
      id: "b",
      createdAt: "2026-07-23T11:00:00.000Z",
      action: ACTIVITY_ACTIONS.TASK_SCHEDULE,
    }),
    entry({
      id: "c",
      createdAt: "2026-07-23T12:00:00.000Z",
      action: ACTIVITY_ACTIONS.TASK_START,
    }),
    entry({
      id: "d",
      createdAt: "2026-07-23T13:00:00.000Z",
      action: ACTIVITY_ACTIONS.TASK_APPROVE,
    }),
    entry({
      id: "e",
      createdAt: "2026-07-23T14:00:00.000Z",
      action: ACTIVITY_ACTIONS.ATENCION_RESOLVE,
      module: "atencion",
    }),
  ])

  assert.equal(summary.eventsRegistered, 5)
  assert.equal(summary.tasksCreated, 1)
  assert.equal(summary.tasksScheduled, 1)
  assert.equal(summary.tasksStarted, 1)
  assert.equal(summary.tasksFinished, 1)
  assert.equal(summary.consultationsAttended, 1)
  assert.equal(summary.lastActivityAt, "2026-07-23T14:00:00.000Z")
})

test("timeline groups by local day and sorts chronologically within day", () => {
  const groups = groupEmployeeActivityByDay([
    entry({
      id: "2",
      createdAt: "2026-07-23T15:00:00.000Z",
      action: ACTIVITY_ACTIONS.TASK_START,
    }),
    entry({
      id: "1",
      createdAt: "2026-07-23T10:00:00.000Z",
      action: ACTIVITY_ACTIONS.TASK_CREATE,
    }),
    entry({
      id: "3",
      createdAt: "2026-07-22T18:00:00.000Z",
      action: ACTIVITY_ACTIONS.TASK_CREATE,
    }),
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0].entries.map((item) => item.id).join(","), "1,2")
  assert.equal(groups[1].entries[0].id, "3")
})
