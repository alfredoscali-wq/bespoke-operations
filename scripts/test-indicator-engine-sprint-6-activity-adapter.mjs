import assert from "node:assert/strict"
import test from "node:test"

import {
  activityAdapter,
  activityAdapterV2,
  getActivityAdapter,
  mapActivityEngineEventV1ToInput,
  validateActivityInput,
} from "../lib/indicator-engine/index.ts"

test("Sprint 6: ActivityAdapterV1 maps camelCase business fields", () => {
  const input = activityAdapter.adapt([
    {
      id: "evt-1",
      module: "tasks",
      action: "workorder.finished",
      entityType: "task",
      entityId: "task-1",
      employeeId: "emp-1",
      createdAt: "2026-08-01T12:00:00.000Z",
      title: "OT finalizada",
      description: "Cierre de obra",
      metadata: { new_next_step: "realizar_retencion", noise: { nested: true } },
    },
  ])

  assert.equal(validateActivityInput(input).length, 0)
  assert.equal(input.events.length, 1)
  assert.equal(input.events[0].module, "tasks")
  assert.equal(input.events[0].action, "workorder.finished")
  assert.equal(input.events[0].metadata.new_next_step, "realizar_retencion")
  assert.equal(input.events[0].metadata.noise, undefined)
})

test("Sprint 6: strips Activity Engine technical fields", () => {
  const mapped = mapActivityEngineEventV1ToInput({
    id: "evt-2",
    module: "atencion",
    action: "attention.created",
    entityType: "customer_atencion",
    entityId: "att-1",
    employeeId: "emp-2",
    createdAt: "2026-08-01T13:00:00.000Z",
    title: "Consulta",
    description: null,
    metadata: {},
    // Technical AE fields — must not appear on Activity Input
    severity: "INFO",
    origin: "web",
    actorType: "employee",
    sessionId: "sess-1",
    latitude: -34.6,
    longitude: -58.4,
    durationMs: 1200,
    companyId: "company-should-not-pass",
    correlationId: "corr-1",
    result: "SUCCESS",
  })

  assert.ok(mapped)
  assert.equal(mapped.module, "atencion")
  assert.equal("severity" in mapped, false)
  assert.equal("origin" in mapped, false)
  assert.equal("actorType" in mapped, false)
  assert.equal("sessionId" in mapped, false)
  assert.equal("latitude" in mapped, false)
  assert.equal("companyId" in mapped, false)
  assert.equal("result" in mapped, false)
})

test("Sprint 6: accepts snake_case source fields", () => {
  const mapped = mapActivityEngineEventV1ToInput({
    id: "evt-3",
    module: "projects",
    action: "project.started",
    entity_type: "project",
    entity_id: "proj-1",
    employee_id: "emp-3",
    created_at: "2026-08-01T14:00:00.000Z",
    detail: "Inicio de obra",
    metadata: {},
  })

  assert.ok(mapped)
  assert.equal(mapped.entityType, "project")
  assert.equal(mapped.entityId, "proj-1")
  assert.equal(mapped.employeeId, "emp-3")
  assert.equal(mapped.createdAt, "2026-08-01T14:00:00.000Z")
  assert.equal(mapped.description, "Inicio de obra")
})

test("Sprint 6: canonicalises legacy modules inside adapter only", () => {
  const input = activityAdapter.adapt([
    {
      module: "customer_service",
      action: "case.created",
      createdAt: "2026-08-01T15:00:00.000Z",
      metadata: {},
    },
    {
      module: "sales",
      action: "commercial.activity.completed",
      createdAt: "2026-08-01T15:01:00.000Z",
      metadata: {},
    },
  ])

  assert.equal(input.events[0].module, "atencion")
  assert.equal(input.events[1].module, "commercial")
})

test("Sprint 6: skips incomplete events instead of throwing", () => {
  const input = activityAdapter.adapt([
    { module: "tasks", action: "workorder.started" }, // missing createdAt
    {
      module: "tasks",
      action: "workorder.started",
      createdAt: "2026-08-01T16:00:00.000Z",
      metadata: {},
    },
  ])

  assert.equal(input.events.length, 1)
  assert.equal(input.events[0].action, "workorder.started")
})

test("Sprint 6: getActivityAdapter resolves v1; v2 is reserved", () => {
  assert.equal(getActivityAdapter("v1").version, "v1")
  assert.equal(getActivityAdapter("v2").name, "ActivityAdapterV2")
  assert.throws(() => activityAdapterV2.adapt([{ schemaVersion: 2, payload: {} }]))
  assert.deepEqual(activityAdapterV2.adapt([]), { events: [] })
})
