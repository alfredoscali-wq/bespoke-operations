import assert from "node:assert/strict"
import test from "node:test"

import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
  ACTIVITY_SEVERITIES,
  isActivityAction,
  listActivityActions,
  mapLegacyAuditActionToActivity,
  resolveActivityActionDefinition,
  tryMapLegacyAuditActionToActivity,
  buildActivityEventRpcArgs,
  validateRecordActivityEventInput,
} from "../lib/activity/index.ts"
import { AUDIT_ACTIONS } from "../lib/audit/types.ts"
import { recordActivityEventWithClient } from "../lib/activity/record-activity-event-core.ts"

const COMPANY_ID = "11111111-1111-4111-8111-111111111111"
const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222"
const ENTITY_ID = "33333333-3333-4333-8333-333333333333"
const CORRELATION_ID = "44444444-4444-4444-8444-444444444444"
const EVENT_ID = "55555555-5555-4555-8555-555555555555"

test("catálogo: todas las acciones tienen definición consistente", () => {
  const actions = listActivityActions()
  assert.ok(actions.length >= 80)

  for (const action of actions) {
    assert.equal(isActivityAction(action), true)
    const def = resolveActivityActionDefinition(action)
    assert.ok(def.module)
    assert.ok(def.entityType)
    assert.ok(def.label)
    assert.ok(
      Object.values(ACTIVITY_SEVERITIES).includes(def.severity),
      `${action} severity`
    )
  }
})

test("catálogo: rechaza acción desconocida", () => {
  assert.equal(isActivityAction("CREATE_TASK"), false)
  assert.equal(isActivityAction("TASK_CREATED"), false)
  assert.equal(isActivityAction("NEW_TASK"), false)
})

test("validación: payload mínimo válido con metadata y correlation_id", () => {
  const args = buildActivityEventRpcArgs({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    actorType: ACTIVITY_ACTOR_TYPES.EMPLOYEE,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: ENTITY_ID,
    action: ACTIVITY_ACTIONS.TASK_CREATE,
    detail: "OT creada en test",
    metadata: { source: "unit-test", code: "OT-1" },
    origin: ACTIVITY_ORIGINS.WEB,
    correlationId: CORRELATION_ID,
  })

  assert.equal(args.p_company_id, COMPANY_ID)
  assert.equal(args.p_employee_id, EMPLOYEE_ID)
  assert.equal(args.p_actor_type, "employee")
  assert.equal(args.p_action, "TASK_CREATE")
  assert.equal(args.p_origin, "web")
  assert.equal(args.p_correlation_id, CORRELATION_ID)
  assert.equal(args.p_severity, "INFO")
  assert.equal(args.p_metadata.source, "unit-test")
  assert.equal(args.p_detail, "OT creada en test")
})

test("validación: actor_type system no admite employeeId", () => {
  assert.throws(
    () =>
      validateRecordActivityEventInput({
        companyId: COMPANY_ID,
        employeeId: EMPLOYEE_ID,
        actorType: ACTIVITY_ACTOR_TYPES.SYSTEM,
        module: ACTIVITY_MODULES.SYSTEM,
        entityType: ACTIVITY_ENTITY_TYPES.TASK,
        action: ACTIVITY_ACTIONS.FORCE_DELETE,
        origin: ACTIVITY_ORIGINS.SYSTEM,
      }),
    /system no debe incluir employeeId/
  )
})

test("validación: módulo inconsistente con la acción", () => {
  assert.throws(
    () =>
      validateRecordActivityEventInput({
        companyId: COMPANY_ID,
        actorType: ACTIVITY_ACTOR_TYPES.USER,
        module: ACTIVITY_MODULES.CUSTOMERS,
        entityType: ACTIVITY_ENTITY_TYPES.TASK,
        action: ACTIVITY_ACTIONS.TASK_CREATE,
        origin: ACTIVITY_ORIGINS.WEB,
      }),
    /no corresponde/
  )
})

test("validación: origin inválido", () => {
  assert.throws(
    () =>
      validateRecordActivityEventInput({
        companyId: COMPANY_ID,
        actorType: ACTIVITY_ACTOR_TYPES.USER,
        module: ACTIVITY_MODULES.TASKS,
        entityType: ACTIVITY_ENTITY_TYPES.TASK,
        action: ACTIVITY_ACTIONS.TASK_CREATE,
        // @ts-expect-error intentional invalid origin
        origin: "desktop",
      }),
    /origin inválido/
  )
})

test("legacy map: AUDIT_ACTIONS → Activity sin huecos", () => {
  for (const legacy of Object.values(AUDIT_ACTIONS)) {
    const mapped = mapLegacyAuditActionToActivity(legacy)
    assert.equal(isActivityAction(mapped), true, legacy)
  }

  assert.equal(
    mapLegacyAuditActionToActivity(AUDIT_ACTIONS.TASK_FINISH),
    ACTIVITY_ACTIONS.TASK_APPROVE
  )
  assert.equal(
    mapLegacyAuditActionToActivity(AUDIT_ACTIONS.PLANNING_CONFIRMED),
    ACTIVITY_ACTIONS.PLANNING_CONFIRM
  )
  assert.equal(
    mapLegacyAuditActionToActivity(AUDIT_ACTIONS.SHIFT_STARTED),
    ACTIVITY_ACTIONS.SHIFT_START
  )
  assert.equal(tryMapLegacyAuditActionToActivity("UNKNOWN_LEGACY"), null)
})

test("helper: inserción correcta vía RPC mock (metadata, correlation, actor, origin)", async () => {
  /** @type {Record<string, unknown> | null} */
  let capturedArgs = null

  const client = {
    rpc: async (fn, args) => {
      assert.equal(fn, "record_activity_event")
      capturedArgs = args
      return { data: EVENT_ID, error: null }
    },
    from: (table) => {
      assert.equal(table, "activity_events")
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: EVENT_ID,
                company_id: COMPANY_ID,
                employee_id: EMPLOYEE_ID,
                actor_type: "employee",
                module: "tasks",
                entity_type: "task",
                entity_id: ENTITY_ID,
                action: "TASK_START",
                detail: "Inicio Mobile",
                metadata: { lat: -34.6, lng: -58.4 },
                origin: "mobile",
                correlation_id: CORRELATION_ID,
                severity: "INFO",
                created_at: "2026-07-21T12:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }
    },
  }

  const row = await recordActivityEventWithClient(/** @type {any} */ (client), {
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    actorType: ACTIVITY_ACTOR_TYPES.EMPLOYEE,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: ENTITY_ID,
    action: ACTIVITY_ACTIONS.TASK_START,
    detail: "Inicio Mobile",
    metadata: { lat: -34.6, lng: -58.4 },
    origin: ACTIVITY_ORIGINS.MOBILE,
    correlationId: CORRELATION_ID,
  })

  assert.ok(capturedArgs)
  assert.equal(capturedArgs.p_actor_type, "employee")
  assert.equal(capturedArgs.p_origin, "mobile")
  assert.equal(capturedArgs.p_correlation_id, CORRELATION_ID)
  assert.equal(capturedArgs.p_metadata.lat, -34.6)
  assert.equal(row.id, EVENT_ID)
  assert.equal(row.action, "TASK_START")
  assert.equal(row.origin, "mobile")
  assert.equal(row.actorType, "employee")
  assert.equal(row.correlationId, CORRELATION_ID)
  assert.equal(row.metadata.lng, -58.4)
})
