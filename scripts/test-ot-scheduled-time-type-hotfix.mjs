/**
 * Production hotfix: tasks.scheduled_time is TIME (nullable).
 * create_task_with_execution_order inserted jsonb text (->>) without ::time,
 * which Postgres rejects:
 *   column "scheduled_time" is of type time without time zone but expression is of type text
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  mapCreatePayloadToInsert,
  mapUpdatePayloadToUpdate,
} from "../lib/supabase/tasks.mapper.ts"
import { normalizeScheduledTimeForDb } from "../lib/tasks/scheduling.ts"
import {
  buildWorkOrderCreatePayload,
  buildWorkOrderUpdatePayload,
  getDefaultWorkOrderForm,
} from "../lib/tasks/work-order.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const PRODUCTION_SCHEDULED_TIME_TYPE_ERROR =
  'column "scheduled_time" is of type time without time zone but expression is of type text'

const UNCAST_RPC_TIME_EXPR =
  "NULLIF(btrim(COALESCE(v_payload->>'scheduled_time', '')), '')"

const ot11Sql = read(
  "supabase/migrations/20261142000100_ot_1_1_execution_order_atomic.sql"
)
const hotfixSql = read(
  "supabase/migrations/20261147000100_ot_scheduled_time_type_hotfix.sql"
)
const mapperSource = read("lib/supabase/tasks.mapper.ts")

/**
 * jsonb ->> always yields text. Assigning that expression to a TIME column
 * is the production 42804 error (empty string or HH:MM/HH:MM:SS alike).
 */
function postgresTimeInsertError(expressionType, value) {
  if (expressionType === "text" && value !== null && value !== undefined) {
    return PRODUCTION_SCHEDULED_TIME_TYPE_ERROR
  }
  return null
}

function baseCreatePayload(overrides = {}) {
  return {
    code: "OT-TIME-1",
    title: "Service Técnico",
    description: "",
    projectCode: "OT",
    projectName: "Cliente",
    type: "maintenance",
    priority: "media",
    supervisor: "Supervisor",
    crew: "Cuadrilla A",
    startDate: "2026-08-27",
    dueDate: "2026-08-27",
    estimatedDuration: "45 min",
    checklist: [],
    ...overrides,
  }
}

test("reproduce error de producción: text incompatible con TIME", () => {
  assert.equal(
    postgresTimeInsertError("text", ""),
    PRODUCTION_SCHEDULED_TIME_TYPE_ERROR
  )
  assert.equal(
    postgresTimeInsertError("text", "08:00"),
    PRODUCTION_SCHEDULED_TIME_TYPE_ERROR
  )
  assert.equal(
    postgresTimeInsertError("text", "08:00:00"),
    PRODUCTION_SCHEDULED_TIME_TYPE_ERROR
  )
  assert.equal(postgresTimeInsertError("text", null), null)
  assert.equal(postgresTimeInsertError("time", "08:00:00"), null)

  const uncastLine = ot11Sql
    .split("\n")
    .find((line) => line.includes("v_payload->>'scheduled_time'"))
  assert.ok(uncastLine?.includes(UNCAST_RPC_TIME_EXPR))
  assert.doesNotMatch(uncastLine ?? "", /::time/)
})

test("migración OT 1.1 no se modifica; el hotfix caste a TIME", () => {
  assert.match(ot11Sql, /NULLIF\(btrim\(COALESCE\(v_payload->>'scheduled_time', ''\)\), ''\),/)
  assert.doesNotMatch(
    ot11Sql,
    /NULLIF\(btrim\(COALESCE\(v_payload->>'scheduled_time', ''\)\), ''\)::time/
  )
  assert.doesNotMatch(hotfixSql, /ALTER TABLE public\.tasks/)
  assert.doesNotMatch(hotfixSql, /scheduled_time time NOT NULL/)
  assert.match(
    hotfixSql,
    /NULLIF\(btrim\(COALESCE\(v_payload->>'scheduled_time', ''\)\), ''\)::time/
  )
  assert.match(hotfixSql, /\(v_payload->>'start_date'\)::date/)
  assert.match(hotfixSql, /\(v_payload->>'due_date'\)::date/)
})

test("create: vacío / null / undefined → null; HH:MM y HH:MM:SS válidos", () => {
  assert.equal(normalizeScheduledTimeForDb(""), null)
  assert.equal(normalizeScheduledTimeForDb("   "), null)
  assert.equal(normalizeScheduledTimeForDb(null), null)
  assert.equal(normalizeScheduledTimeForDb(undefined), null)
  assert.equal(normalizeScheduledTimeForDb("08:00"), "08:00:00")
  assert.equal(normalizeScheduledTimeForDb("14:30:00"), "14:30:00")

  assert.equal(
    mapCreatePayloadToInsert(baseCreatePayload({ scheduledTime: "" })).scheduled_time,
    null
  )
  assert.equal(
    mapCreatePayloadToInsert(baseCreatePayload({ scheduledTime: null })).scheduled_time,
    null
  )
  assert.equal(
    mapCreatePayloadToInsert(baseCreatePayload({})).scheduled_time,
    null
  )
  assert.equal(
    mapCreatePayloadToInsert(baseCreatePayload({ scheduledTime: "08:00" }))
      .scheduled_time,
    "08:00:00"
  )
  assert.equal(
    mapCreatePayloadToInsert(baseCreatePayload({ scheduledTime: "08:00:00" }))
      .scheduled_time,
    "08:00:00"
  )

  const withTime = mapCreatePayloadToInsert(
    baseCreatePayload({
      scheduledTime: "09:15",
      startDate: "2026-08-27",
      dueDate: "2026-08-28",
    })
  )
  assert.equal(withTime.start_date, "2026-08-27")
  assert.equal(withTime.due_date, "2026-08-28")
  assert.notEqual(withTime.scheduled_time, "")
})

test("edit usa la misma normalización que create", () => {
  assert.match(mapperSource, /normalizeScheduledTimeForDb\(payload\.scheduledTime\)/)
  assert.equal(
    (mapperSource.match(/normalizeScheduledTimeForDb\(payload\.scheduledTime\)/g) || [])
      .length,
    2
  )

  assert.equal(mapUpdatePayloadToUpdate({ scheduledTime: "" }).scheduled_time, null)
  assert.equal(mapUpdatePayloadToUpdate({ scheduledTime: null }).scheduled_time, null)
  assert.equal(
    mapUpdatePayloadToUpdate({ scheduledTime: "09:00" }).scheduled_time,
    "09:00:00"
  )
  assert.equal(
    mapUpdatePayloadToUpdate({ scheduledTime: "09:00:00" }).scheduled_time,
    "09:00:00"
  )
  assert.equal("scheduled_time" in mapUpdatePayloadToUpdate({ title: "X" }), false)
})

test("OT con y sin horario: create y edit del mismo formulario", () => {
  const withShift = buildWorkOrderCreatePayload({
    form: {
      ...getDefaultWorkOrderForm(),
      serviceType: "service-tecnico",
      customerName: "Cliente",
      customerId: "customer-1",
      address: "Calle 1",
      serviceReason: "sin-conexion",
      serviceDetail: "Sin servicio",
      scheduledDate: "2026-08-27",
      shift: "manana",
      crewId: "crew-1",
      estimatedDurationPreset: "45",
    },
    existingTasks: [],
    customerId: "customer-1",
    checklist: [],
  })
  const insertWithShift = mapCreatePayloadToInsert({
    ...withShift,
    description: withShift.description ?? "",
    progress: 0,
  })
  assert.equal(insertWithShift.scheduled_time, "08:00:00")
  assert.notEqual(insertWithShift.scheduled_time, "")

  const withoutShift = buildWorkOrderCreatePayload({
    form: {
      ...getDefaultWorkOrderForm(),
      serviceType: "service-tecnico",
      customerName: "Cliente",
      customerId: "customer-1",
      address: "Calle 1",
      serviceReason: "sin-conexion",
      serviceDetail: "Sin servicio",
      scheduledDate: "2026-08-27",
      shift: "",
      crewId: "crew-1",
      estimatedDurationPreset: "45",
    },
    existingTasks: [],
    customerId: "customer-1",
    checklist: [],
  })
  assert.equal(withoutShift.scheduledTime, null)
  const insertWithoutShift = mapCreatePayloadToInsert({
    ...withoutShift,
    description: withoutShift.description ?? "",
    progress: 0,
  })
  assert.equal(insertWithoutShift.scheduled_time, null)
  assert.equal(insertWithoutShift.due_date, "2026-08-27")
  assert.equal(insertWithoutShift.start_date, "2026-08-27")

  const task = {
    id: "task-1",
    code: withShift.code,
    title: withShift.title,
    description: withShift.description ?? "",
    projectCode: "OT",
    projectName: withShift.projectName,
    type: "maintenance",
    status: "programada",
    priority: "media",
    supervisor: withShift.supervisor,
    crewId: withShift.crewId,
    crew: withShift.crew,
    startDate: withShift.startDate,
    dueDate: withShift.dueDate,
    scheduledTime: withShift.scheduledTime,
    estimatedDuration: withShift.estimatedDuration,
    checklist: [],
    progress: 0,
    serviceType: "service-tecnico",
    taskMetadata: withShift.taskMetadata,
  }
  const updatePayload = buildWorkOrderUpdatePayload({
    form: {
      ...getDefaultWorkOrderForm(),
      serviceType: "service-tecnico",
      customerName: "Cliente",
      customerId: "customer-1",
      address: "Calle 1",
      serviceReason: "sin-conexion",
      serviceDetail: "Sin servicio",
      scheduledDate: "2026-08-27",
      shift: "tarde",
      crewId: "crew-1",
      estimatedDurationPreset: "45",
    },
    task,
    existingTasks: [task],
    customerId: "customer-1",
  })
  const update = mapUpdatePayloadToUpdate(updatePayload)
  assert.equal(update.scheduled_time, "14:00:00")
  assert.equal(update.due_date, "2026-08-27")
  assert.equal(update.start_date, "2026-08-27")
})
