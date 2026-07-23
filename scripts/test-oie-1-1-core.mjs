import assert from "node:assert/strict"
import test from "node:test"

import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
  ACTIVITY_RESULTS,
  assertActivityResultAllowed,
  buildActivityEventRpcArgs,
  isActivityResult,
  listActivityResults,
  validateRecordActivityEventInput,
} from "../lib/activity/index.ts"
import { recordActivityEventWithClient } from "../lib/activity/record-activity-event-core.ts"

const COMPANY_ID = "11111111-1111-4111-8111-111111111111"
const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222"
const ENTITY_ID = "33333333-3333-4333-8333-333333333333"
const SESSION_ID = "66666666-6666-4666-8666-666666666666"
const EVENT_ID = "55555555-5555-4555-8555-555555555555"
const SYNC_BATCH_ID = "77777777-7777-4777-8777-777777777777"

function baseTaskCreate(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    actorType: ACTIVITY_ACTOR_TYPES.EMPLOYEE,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: ENTITY_ID,
    action: ACTIVITY_ACTIONS.TASK_CREATE,
    detail: "OT creada",
    origin: ACTIVITY_ORIGINS.WEB,
    ...overrides,
  }
}

test("OIE 1.1: catálogo de results", () => {
  const results = listActivityResults()
  assert.ok(results.includes(ACTIVITY_RESULTS.SUCCESS))
  assert.ok(results.includes(ACTIVITY_RESULTS.INTERESTED))
  assert.ok(results.includes(ACTIVITY_RESULTS.RESOLVED))
  assert.equal(isActivityResult("SUCCESS"), true)
  assert.equal(isActivityResult("MAYBE"), false)
})

test("OIE 1.1: evento simple (compatibilidad payload antiguo)", () => {
  const args = buildActivityEventRpcArgs(baseTaskCreate())

  assert.equal(args.p_action, "TASK_CREATE")
  assert.equal(args.p_result, null)
  assert.equal(args.p_session_id, null)
  assert.equal(args.p_duration_ms, null)
  assert.equal(args.p_latitude, null)
  assert.equal(args.p_longitude, null)
  assert.equal(args.p_accuracy_m, null)
  assert.deepEqual(args.p_metadata, {})
})

test("OIE 1.1: evento con result", () => {
  const args = buildActivityEventRpcArgs(
    baseTaskCreate({
      action: ACTIVITY_ACTIONS.ATENCION_CLOSE,
      module: ACTIVITY_MODULES.ATENCION,
      entityType: ACTIVITY_ENTITY_TYPES.CUSTOMER_ATENCION,
      result: ACTIVITY_RESULTS.RESOLVED,
      detail: "Consulta cerrada",
    })
  )

  assert.equal(args.p_action, "ATENCION_CLOSE")
  assert.equal(args.p_result, "RESOLVED")
})

test("OIE 1.1: rechaza result no permitido para la acción", () => {
  assert.throws(
    () =>
      assertActivityResultAllowed(
        ACTIVITY_ACTIONS.ATENCION_CLOSE,
        ACTIVITY_RESULTS.WON
      ),
    /no está permitido/
  )

  assert.throws(
    () =>
      validateRecordActivityEventInput(
        baseTaskCreate({
          action: ACTIVITY_ACTIONS.TASK_APPROVE,
          result: ACTIVITY_RESULTS.INTERESTED,
        })
      ),
    /no está permitido/
  )
})

test("OIE 1.1: evento con GPS", () => {
  const args = buildActivityEventRpcArgs(
    baseTaskCreate({
      action: ACTIVITY_ACTIONS.TASK_START,
      origin: ACTIVITY_ORIGINS.MOBILE,
      geo: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracyM: 12.5,
      },
    })
  )

  assert.equal(args.p_latitude, -34.6037)
  assert.equal(args.p_longitude, -58.3816)
  assert.equal(args.p_accuracy_m, 12.5)
})

test("OIE 1.1: rechaza GPS incompleto o fuera de rango", () => {
  assert.throws(
    () =>
      validateRecordActivityEventInput(
        baseTaskCreate({
          geo: { latitude: 200, longitude: 0 },
        })
      ),
    /latitude fuera de rango/
  )
})

test("OIE 1.1: evento con session", () => {
  const args = buildActivityEventRpcArgs(
    baseTaskCreate({
      action: ACTIVITY_ACTIONS.SHIFT_START,
      module: ACTIVITY_MODULES.MOBILE,
      entityType: ACTIVITY_ENTITY_TYPES.WORK_TEAM_SHIFT,
      sessionId: SESSION_ID,
      origin: ACTIVITY_ORIGINS.MOBILE,
    })
  )

  assert.equal(args.p_session_id, SESSION_ID)
})

test("OIE 1.1: evento con duration", () => {
  const args = buildActivityEventRpcArgs(
    baseTaskCreate({
      action: ACTIVITY_ACTIONS.SHIFT_FINISH,
      module: ACTIVITY_MODULES.MOBILE,
      entityType: ACTIVITY_ENTITY_TYPES.WORK_TEAM_SHIFT,
      sessionId: SESSION_ID,
      result: ACTIVITY_RESULTS.SUCCESS,
      durationMs: 8 * 60 * 60 * 1000,
      origin: ACTIVITY_ORIGINS.MOBILE,
    })
  )

  assert.equal(args.p_duration_ms, 28800000)
  assert.equal(args.p_result, "SUCCESS")
  assert.equal(args.p_session_id, SESSION_ID)
})

test("OIE 1.1: client metadata se fusiona en metadata.client", () => {
  const args = buildActivityEventRpcArgs(
    baseTaskCreate({
      metadata: { source: "unit" },
      client: {
        platform: "android",
        appVersion: "1.2.3",
        offlineSync: true,
        syncBatchId: SYNC_BATCH_ID,
        networkType: "cellular",
        batteryPct: 64,
      },
      origin: ACTIVITY_ORIGINS.MOBILE,
    })
  )

  assert.equal(args.p_metadata.source, "unit")
  assert.equal(args.p_metadata.client.platform, "android")
  assert.equal(args.p_metadata.client.appVersion, "1.2.3")
  assert.equal(args.p_metadata.client.offlineSync, true)
  assert.equal(args.p_metadata.client.syncBatchId, SYNC_BATCH_ID)
  assert.equal(args.p_metadata.client.batteryPct, 64)
})

test("OIE 1.1: helper RPC mock con extensiones", async () => {
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
                module: "sales",
                entity_type: "sales_visit",
                entity_id: ENTITY_ID,
                action: "SALE_VISIT_COMPLETE",
                detail: "Visita OK",
                metadata: {
                  client: { platform: "android", appVersion: "2.0.0" },
                },
                origin: "mobile",
                correlation_id: null,
                severity: "INFO",
                created_at: "2026-07-22T12:00:00.000Z",
                result: "INTERESTED",
                session_id: SESSION_ID,
                duration_ms: 1800000,
                latitude: -34.6,
                longitude: -58.4,
                accuracy_m: 8,
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
    module: ACTIVITY_MODULES.SALES,
    entityType: ACTIVITY_ENTITY_TYPES.SALES_VISIT,
    entityId: ENTITY_ID,
    action: ACTIVITY_ACTIONS.SALE_VISIT_COMPLETE,
    detail: "Visita OK",
    result: ACTIVITY_RESULTS.INTERESTED,
    sessionId: SESSION_ID,
    durationMs: 1_800_000,
    geo: { latitude: -34.6, longitude: -58.4, accuracyM: 8 },
    client: { platform: "android", appVersion: "2.0.0" },
    origin: ACTIVITY_ORIGINS.MOBILE,
  })

  assert.ok(capturedArgs)
  assert.equal(capturedArgs.p_result, "INTERESTED")
  assert.equal(capturedArgs.p_session_id, SESSION_ID)
  assert.equal(capturedArgs.p_duration_ms, 1_800_000)
  assert.equal(capturedArgs.p_latitude, -34.6)
  assert.equal(capturedArgs.p_longitude, -58.4)
  assert.equal(capturedArgs.p_accuracy_m, 8)
  assert.equal(capturedArgs.p_metadata.client.platform, "android")

  assert.equal(row.id, EVENT_ID)
  assert.equal(row.result, "INTERESTED")
  assert.equal(row.sessionId, SESSION_ID)
  assert.equal(row.durationMs, 1_800_000)
  assert.equal(row.latitude, -34.6)
  assert.equal(row.longitude, -58.4)
  assert.equal(row.accuracyM, 8)
})

test("OIE 1.1: fila antigua sin columnas nuevas se mapea a null", async () => {
  const client = {
    rpc: async () => ({ data: EVENT_ID, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: EVENT_ID,
              company_id: COMPANY_ID,
              employee_id: null,
              actor_type: "system",
              module: "system",
              entity_type: "task",
              entity_id: ENTITY_ID,
              action: "FORCE_DELETE",
              detail: "legacy",
              metadata: {},
              origin: "system",
              correlation_id: null,
              severity: "CRITICAL",
              created_at: "2026-07-01T00:00:00.000Z",
            },
            error: null,
          }),
        }),
      }),
    }),
  }

  const row = await recordActivityEventWithClient(/** @type {any} */ (client), {
    companyId: COMPANY_ID,
    actorType: ACTIVITY_ACTOR_TYPES.SYSTEM,
    module: ACTIVITY_MODULES.SYSTEM,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: ENTITY_ID,
    action: ACTIVITY_ACTIONS.FORCE_DELETE,
    detail: "legacy",
    origin: ACTIVITY_ORIGINS.SYSTEM,
  })

  assert.equal(row.result, null)
  assert.equal(row.sessionId, null)
  assert.equal(row.durationMs, null)
  assert.equal(row.latitude, null)
  assert.equal(row.longitude, null)
  assert.equal(row.accuracyM, null)
})
