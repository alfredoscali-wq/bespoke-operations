import assert from "node:assert/strict"
import test from "node:test"

import {
  ACTIVITY_ACTIONS,
  isActivityAction,
  listActivityActions,
} from "../lib/activity-engine/activity-actions.ts"
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
  ACTIVITY_ORIGINS,
} from "../lib/activity-engine/activity-types.ts"
import {
  normalizeActivityRecordInput,
  validateActivityRecordInput,
} from "../lib/activity-engine/activity-validate.ts"
import { persistActivityRecordWithClient } from "../lib/activity-engine/activity-persist-core.ts"

const COMPANY_ID = "11111111-1111-4111-8111-111111111111"
const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222"
const ENTITY_ID = "33333333-3333-4333-8333-333333333333"
const EVENT_ID = "55555555-5555-4555-8555-555555555555"

test("catálogo 1.1A: acciones mínimas presentes", () => {
  const actions = listActivityActions()
  assert.ok(actions.includes(ACTIVITY_ACTIONS.CALL_STARTED))
  assert.ok(actions.includes(ACTIVITY_ACTIONS.NOTE_CREATED))
  assert.ok(actions.includes(ACTIVITY_ACTIONS.OT_CREATED))
  assert.equal(isActivityAction("UNKNOWN_ACTION"), false)
})

test("validación: rechaza campos obligatorios faltantes", () => {
  const error = validateActivityRecordInput({
    companyId: "",
    module: "atencion",
    entityType: "customer_atencion",
    entityId: ENTITY_ID,
    action: ACTIVITY_ACTIONS.NOTE_CREATED,
    category: ACTIVITY_CATEGORIES.COMMUNICATION,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.USER,
  })
  assert.ok(error)
  assert.equal(error.code, "VALIDATION_ERROR")
  assert.equal(error.field, "companyId")
})

test("validación: rechaza action fuera de catálogo", () => {
  const error = validateActivityRecordInput({
    companyId: COMPANY_ID,
    module: "atencion",
    entityType: "customer_atencion",
    entityId: ENTITY_ID,
    action: "NOT_IN_CATALOG",
    category: ACTIVITY_CATEGORIES.CONTACT,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.USER,
  })
  assert.ok(error)
  assert.equal(error.field, "action")
})

test("validación: payload mínimo válido", () => {
  const input = normalizeActivityRecordInput({
    companyId: ` ${COMPANY_ID} `,
    module: " atencion ",
    entityType: " customer_atencion ",
    entityId: ENTITY_ID,
    employeeId: EMPLOYEE_ID,
    action: ACTIVITY_ACTIONS.NOTE_CREATED,
    category: ACTIVITY_CATEGORIES.COMMUNICATION,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.USER,
    metadata: { source: "unit-test" },
  })
  assert.equal(validateActivityRecordInput(input), null)
  assert.equal(input.companyId, COMPANY_ID)
  assert.equal(input.module, "atencion")
})

test("activity.record (persist): almacena evento vía RPC mock", async () => {
  const stored = []

  const client = {
    rpc: async (fn, args) => {
      assert.equal(fn, "record_activity_engine_event")
      assert.equal(args.p_company_id, COMPANY_ID)
      assert.equal(args.p_action, ACTIVITY_ACTIONS.CALL_COMPLETED)
      assert.equal(args.p_category, ACTIVITY_CATEGORIES.CONTACT)
      assert.equal(args.p_impact, ACTIVITY_IMPACTS.ACTIVITY)
      assert.equal(args.p_origin, ACTIVITY_ORIGINS.USER)
      stored.push(args)
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
                module: "atencion",
                entity_type: "customer_atencion",
                entity_id: ENTITY_ID,
                employee_id: EMPLOYEE_ID,
                action: ACTIVITY_ACTIONS.CALL_COMPLETED,
                category: ACTIVITY_CATEGORIES.CONTACT,
                impact: ACTIVITY_IMPACTS.ACTIVITY,
                origin: ACTIVITY_ORIGINS.USER,
                metadata: { channel: "phone" },
                created_at: "2026-07-25T03:00:00.000Z",
                updated_at: "2026-07-25T03:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }
    },
  }

  const result = await persistActivityRecordWithClient(client, {
    companyId: COMPANY_ID,
    module: "atencion",
    entityType: "customer_atencion",
    entityId: ENTITY_ID,
    employeeId: EMPLOYEE_ID,
    action: ACTIVITY_ACTIONS.CALL_COMPLETED,
    category: ACTIVITY_CATEGORIES.CONTACT,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.USER,
    metadata: { channel: "phone" },
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.data.id, EVENT_ID)
  assert.equal(result.data.action, ACTIVITY_ACTIONS.CALL_COMPLETED)
  assert.equal(result.data.category, ACTIVITY_CATEGORIES.CONTACT)
  assert.equal(stored.length, 1)
})

test("activity.record: no inserta si la validación falla", async () => {
  let rpcCalled = false
  const client = {
    rpc: async () => {
      rpcCalled = true
      return { data: null, error: null }
    },
    from: () => {
      throw new Error("no debe leer")
    },
  }

  const result = await persistActivityRecordWithClient(client, {
    companyId: COMPANY_ID,
    module: "atencion",
    entityType: "customer_atencion",
    entityId: ENTITY_ID,
    action: "INVALID",
    category: ACTIVITY_CATEGORIES.CONTACT,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.USER,
  })

  assert.equal(result.ok, false)
  assert.equal(rpcCalled, false)
  if (result.ok) return
  assert.equal(result.error.code, "VALIDATION_ERROR")
})
