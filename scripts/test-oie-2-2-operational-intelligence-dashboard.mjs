import assert from "node:assert/strict"
import test from "node:test"

import { buildOperationalIntelligenceDashboard } from "../lib/activity/operational-intelligence-dashboard.ts"
import { ACTIVITY_ACTIONS } from "../lib/activity/types.ts"

function entry(overrides) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    createdAt: overrides.createdAt,
    employeeId: overrides.employeeId ?? null,
    userName: overrides.userName ?? "Usuario",
    companyId: "co",
    companyName: "Co",
    areaCode: overrides.areaCode ?? "tecnica",
    areaLabel: overrides.areaLabel ?? "Operarios",
    module: overrides.module ?? "tasks",
    action: overrides.action,
    entityType: "task",
    entityId: null,
    detail: overrides.detail ?? "detalle",
    origin: "web",
    severity: "info",
    correlationId: null,
    metadata: {},
    actorType: "employee",
  }
}

test("dashboard KPIs and rankings derive from loaded events only", () => {
  const reference = new Date(2026, 6, 23, 16, 0, 0)
  const dashboard = buildOperationalIntelligenceDashboard(
    [
      entry({
        id: "1",
        createdAt: new Date(2026, 6, 23, 10, 0, 0).toISOString(),
        employeeId: "e1",
        userName: "Ana",
        areaLabel: "Atención al Cliente",
        areaCode: "atencion",
        action: ACTIVITY_ACTIONS.ATENCION_RESOLVE,
        module: "atencion",
      }),
      entry({
        id: "2",
        createdAt: new Date(2026, 6, 23, 11, 0, 0).toISOString(),
        employeeId: "e1",
        userName: "Ana",
        areaLabel: "Atención al Cliente",
        areaCode: "atencion",
        action: ACTIVITY_ACTIONS.TASK_CREATE,
      }),
      entry({
        id: "3",
        createdAt: new Date(2026, 6, 23, 15, 30, 0).toISOString(),
        employeeId: "e2",
        userName: "Bruno",
        areaLabel: "Operarios",
        areaCode: "tecnica",
        action: ACTIVITY_ACTIONS.TASK_START,
      }),
      entry({
        id: "4",
        createdAt: new Date(2026, 6, 22, 12, 0, 0).toISOString(),
        employeeId: "e2",
        userName: "Bruno",
        areaLabel: "Operarios",
        areaCode: "tecnica",
        action: ACTIVITY_ACTIONS.TASK_APPROVE,
      }),
    ],
    reference
  )

  assert.equal(dashboard.kpis.eventsToday, 3)
  assert.equal(dashboard.kpis.activeUsersToday, 2)
  assert.equal(dashboard.kpis.activeAreasToday, 2)
  assert.equal(dashboard.kpis.tasksCreatedToday, 1)
  assert.equal(dashboard.kpis.tasksStartedToday, 1)
  assert.equal(dashboard.kpis.consultationsAttendedToday, 1)
  assert.equal(dashboard.topEmployees[0].employeeName, "Ana")
  assert.equal(dashboard.topEmployees[0].totalEvents, 2)
  assert.equal(dashboard.activityByArea[0].areaLabel, "Atención al Cliente")
  assert.equal(dashboard.activityByArea[0].totalEvents, 2)
  assert.ok(dashboard.topActions.length >= 1)
  assert.equal(dashboard.recentFeed.length, 4)
  assert.equal(dashboard.recentFeed[0].id, "3")
})
