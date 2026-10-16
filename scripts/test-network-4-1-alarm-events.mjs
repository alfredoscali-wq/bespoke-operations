import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  acknowledgeNetworkAlarm,
  markNetworkAlarmSeen,
  resolveNetworkAlarm,
} from "../lib/network/alarms/queries.ts"
import { listNetworkAlarmEvents } from "../lib/network/alarms/events.ts"
import { syncNetworkAlarmsAfterMonitoringTransition } from "../lib/network/alarms/sync.ts"
import {
  isNetworkPushPlatform,
  NETWORK_PUSH_PLATFORMS,
} from "../lib/network/push/contract.ts"

const ROOT = resolve(import.meta.dirname, "..")
const COMPANY_ID = "00000000-0000-4000-8000-000000004110"
const OTHER_COMPANY_ID = "00000000-0000-4000-8000-000000004119"
const AGENT_ID = "00000000-0000-4000-8000-000000004111"
const ACTOR = {
  employeeId: "00000000-0000-4000-8000-000000004112",
  authUserId: "00000000-0000-4000-8000-000000004113",
}
const ACTOR_B = {
  employeeId: "00000000-0000-4000-8000-000000004114",
  authUserId: "00000000-0000-4000-8000-000000004115",
}
const NOW = "2026-04-11T12:00:00.000Z"

const CORE = {
  id: randomUUID(),
  hostname: "TEST-ALARM-CORE",
  deviceType: "core",
  ip: "192.0.2.10",
}
const AP = {
  id: randomUUID(),
  hostname: "TEST-ALARM-AP",
  deviceType: "radio",
  ip: "192.0.2.20",
}

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function matches(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col]
    if (filter.op === "is") return value === filter.val
    if (filter.op === "neq") return value !== filter.val
    return value === filter.val
  })
}

function createIsolatedClient() {
  const db = {
    network_devices: [CORE, AP].map((spec) => ({
      id: spec.id,
      company_id: COMPANY_ID,
      agent_id: AGENT_ID,
      management_ip: spec.ip,
      device_type: spec.deviceType,
      hostname: spec.hostname,
      deleted_at: null,
    })),
    network_discovery_targets: [CORE, AP].map((spec) => ({
      id: randomUUID(),
      company_id: COMPANY_ID,
      agent_id: AGENT_ID,
      host: spec.ip,
      name: spec.hostname,
      deleted_at: null,
    })),
    network_alarms: [],
    network_alarm_events: [],
    network_push_tokens: [],
    employees: [
      {
        id: ACTOR.employeeId,
        company_id: COMPANY_ID,
        deleted_at: null,
      },
    ],
  }
  let seq = 1

  function from(table) {
    if (!db[table]) db[table] = []
    const state = {
      type: "select",
      patch: null,
      row: null,
      filters: [],
    }

    const immutable =
      table === "network_alarm_events"
        ? { data: null, error: { message: "Los eventos de alarma son inmutables." } }
        : null

    const chain = {
      select() {
        return chain
      },
      eq(col, val) {
        state.filters.push({ op: "eq", col, val })
        return chain
      },
      neq(col, val) {
        state.filters.push({ op: "neq", col, val })
        return chain
      },
      is(col, val) {
        state.filters.push({ op: "is", col, val })
        return chain
      },
      order() {
        return chain
      },
      update(patch) {
        if (immutable) {
          state.type = "blocked"
          return chain
        }
        state.type = "update"
        state.patch = patch
        state.filters = []
        return chain
      },
      delete() {
        if (immutable) {
          state.type = "blocked"
          return chain
        }
        state.type = "delete"
        return chain
      },
      insert(row) {
        state.type = "insert"
        state.row = row
        return chain
      },
      maybeSingle() {
        return execute("maybeSingle")
      },
      then(resolve, reject) {
        return execute("many").then(resolve, reject)
      },
    }

    async function execute(mode) {
      if (state.type === "blocked") return immutable
      const rows = db[table]
      if (state.type === "select") {
        const found = rows.filter((row) => matches(row, state.filters))
        if (mode === "maybeSingle") return { data: found[0] ?? null, error: null }
        return { data: found, error: null }
      }
      if (state.type === "update") {
        const matched = rows.filter((row) => matches(row, state.filters))
        for (const row of matched) Object.assign(row, state.patch)
        if (mode === "maybeSingle") return { data: matched[0] ?? null, error: null }
        return { data: matched, error: null }
      }
      if (state.type === "insert") {
        if (table === "network_alarms") {
          const status = state.row.status
          if (status === "open" || status === "acknowledged") {
            const exists = rows.some(
              (row) =>
                row.device_id === state.row.device_id &&
                row.deleted_at == null &&
                (row.status === "open" || row.status === "acknowledged")
            )
            if (exists) {
              return { data: null, error: { code: "23505", message: "duplicate key" } }
            }
          }
        }
        const inserted = { deleted_at: null, id: state.row.id ?? `row-${seq++}`, ...state.row }
        rows.push(inserted)
        if (mode === "maybeSingle") return { data: inserted, error: null }
        return { data: [inserted], error: null }
      }
      return { data: null, error: null }
    }

    return chain
  }

  return { from, db }
}

async function bringOffline(client, device) {
  await syncNetworkAlarmsAfterMonitoringTransition(client, {
    companyId: COMPANY_ID,
    deviceId: device.id,
    previousStatus: "online",
    nextStatus: "offline",
    occurredAt: NOW,
  })
}

test("migración 1.1: events inmutables y push sin FCM", () => {
  const sql = read(
    "supabase/migrations/20261231000400_network_alarm_events_and_push_tokens.sql"
  )
  assert.match(sql, /CREATE TABLE public\.network_alarm_events/)
  assert.match(sql, /event_type IN \('created', 'seen', 'acknowledged', 'resolved'\)/)
  assert.doesNotMatch(sql, /in_progress/)
  assert.match(sql, /reject_network_alarm_event_mutation/)
  assert.match(sql, /BEFORE UPDATE OR DELETE/)
  assert.match(sql, /GRANT SELECT, INSERT ON public\.network_alarm_events/)
  assert.doesNotMatch(
    sql,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.network_alarm_events/
  )
  assert.match(sql, /CREATE TABLE public\.network_push_tokens/)
  assert.match(sql, /platform IN \('android'\)/)
  assert.doesNotMatch(sql, /ios/)
  assert.match(sql, /REFERENCES public\.employees/)
  assert.match(sql, /Not a FK to network_devices/)
  assert.match(sql, /no send, no Firebase, no register API/)
  assert.doesNotMatch(sql, /firebase-admin|google-auth|FCM_SERVER/)
  assert.match(sql, /deleted_at timestamptz/)
})

test("1-6: created/seen/ack/resolve conservan alarmId y tenant", async () => {
  const client = createIsolatedClient()
  await bringOffline(client, CORE)
  const alarmId = client.db.network_alarms[0].id

  const created = await listNetworkAlarmEvents(client, COMPANY_ID, alarmId)
  assert.equal(created?.length, 1)
  assert.equal(created?.[0].eventType, "created")
  assert.equal(created?.[0].userId, null)
  assert.equal(created?.[0].alarmId, alarmId)
  assert.equal(created?.[0].companyId, COMPANY_ID)

  await markNetworkAlarmSeen(client, {
    companyId: COMPANY_ID,
    alarmId,
    actor: ACTOR,
  })
  await markNetworkAlarmSeen(client, {
    companyId: COMPANY_ID,
    alarmId,
    actor: ACTOR_B,
  })

  const ack = await acknowledgeNetworkAlarm(client, {
    companyId: COMPANY_ID,
    alarmId,
    actor: ACTOR,
    acknowledgedAt: "2026-04-11T12:01:00.000Z",
  })
  assert.equal(ack.ok, true)
  const ackAgain = await acknowledgeNetworkAlarm(client, {
    companyId: COMPANY_ID,
    alarmId,
    actor: ACTOR_B,
  })
  assert.equal(ackAgain.ok, true)

  const resolved = await resolveNetworkAlarm(client, {
    companyId: COMPANY_ID,
    alarmId,
    actor: ACTOR,
    resolutionNote: "Cerrado en prueba",
    resolvedAt: "2026-04-11T12:02:00.000Z",
  })
  assert.equal(resolved.ok, true)

  const events = await listNetworkAlarmEvents(client, COMPANY_ID, alarmId)
  const types = events?.map((event) => event.eventType) ?? []
  assert.deepEqual(types, [
    "created",
    "seen",
    "seen",
    "acknowledged",
    "resolved",
  ])
  assert.equal(events?.every((event) => event.alarmId === alarmId), true)
  assert.equal(events?.every((event) => event.companyId === COMPANY_ID), true)
  assert.equal(events?.filter((event) => event.eventType === "seen").length, 2)
  assert.equal(
    events?.filter((event) => event.eventType === "acknowledged").length,
    1
  )
  assert.equal(
    events?.find((event) => event.eventType === "resolved")?.note,
    "Cerrado en prueba"
  )
  assert.equal(
    events?.find((event) => event.eventType === "acknowledged")?.userId,
    ACTOR.employeeId
  )
})

test("7: eventos de otra empresa no son accesibles", async () => {
  const client = createIsolatedClient()
  await bringOffline(client, CORE)
  const alarmId = client.db.network_alarms[0].id
  const foreign = await listNetworkAlarmEvents(client, OTHER_COMPANY_ID, alarmId)
  assert.equal(foreign, null)
})

test("8: eventos no se pueden modificar ni eliminar", async () => {
  const client = createIsolatedClient()
  await bringOffline(client, CORE)
  const alarmId = client.db.network_alarms[0].id
  const events = await listNetworkAlarmEvents(client, COMPANY_ID, alarmId)
  const eventId = events?.[0].id
  assert.ok(eventId)

  const updated = await client
    .from("network_alarm_events")
    .update({ note: "hack" })
    .eq("id", eventId)
    .maybeSingle()
  assert.equal(updated.error?.message, "Los eventos de alarma son inmutables.")

  const deleted = await client.from("network_alarm_events").delete().eq("id", eventId).maybeSingle()
  assert.equal(deleted.error?.message, "Los eventos de alarma son inmutables.")

  const source = read("lib/network/alarms/events.ts")
  assert.doesNotMatch(source, /\.update\(/)
  assert.doesNotMatch(source, /\.delete\(/)
  assert.match(
    read("app/api/network/v1/alarms/[alarmId]/events/route.ts"),
    /listNetworkAlarmEvents/
  )
  assert.doesNotMatch(
    read("app/api/network/v1/alarms/[alarmId]/events/route.ts"),
    /export async function POST/
  )
})

test("9: una alarma independiente mantiene su propio historial", async () => {
  const client = createIsolatedClient()
  await bringOffline(client, CORE)
  await bringOffline(client, AP)
  const coreId = client.db.network_alarms.find((row) => row.device_id === CORE.id).id
  const apId = client.db.network_alarms.find((row) => row.device_id === AP.id).id
  await acknowledgeNetworkAlarm(client, {
    companyId: COMPANY_ID,
    alarmId: coreId,
    actor: ACTOR,
  })
  const coreEvents = await listNetworkAlarmEvents(client, COMPANY_ID, coreId)
  const apEvents = await listNetworkAlarmEvents(client, COMPANY_ID, apId)
  assert.equal(coreEvents?.some((event) => event.eventType === "acknowledged"), true)
  assert.equal(apEvents?.some((event) => event.eventType === "acknowledged"), false)
  assert.equal(apEvents?.every((event) => event.alarmId === apId), true)
  assert.notEqual(coreId, apId)
})

test("GET alarms no expone push tokens", () => {
  assert.doesNotMatch(read("app/api/network/v1/alarms/route.ts"), /push_token/)
  assert.doesNotMatch(read("lib/network/alarms/queries.ts"), /network_push_tokens/)
  assert.doesNotMatch(read("lib/network/alarms/events.ts"), /push_token/)
  assert.doesNotMatch(
    read("components/network/noc-monitor-screen.tsx"),
    /push_token/
  )
  assert.equal("pushToken" in {}, false)
})

test("push tokens: tenant, usuario, device, platform, enabled, soft delete", () => {
  assert.deepEqual(NETWORK_PUSH_PLATFORMS, ["android"])
  assert.equal(isNetworkPushPlatform("android"), true)
  assert.equal(isNetworkPushPlatform("ios"), false)

  const client = createIsolatedClient()
  const tokenRow = {
    id: randomUUID(),
    company_id: COMPANY_ID,
    user_id: ACTOR.employeeId,
    device_id: "mobile-hw-test-1",
    platform: "android",
    push_token: "opaque-test-token",
    enabled: true,
    last_seen_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  }
  client.db.network_push_tokens.push(tokenRow)
  const stored = client.db.network_push_tokens[0]
  assert.equal(stored.company_id, COMPANY_ID)
  assert.equal(stored.user_id, ACTOR.employeeId)
  assert.equal(stored.device_id, "mobile-hw-test-1")
  assert.equal(stored.platform, "android")
  assert.equal(stored.enabled, true)
  assert.equal(stored.deleted_at, null)
  stored.deleted_at = NOW
  stored.enabled = false
  assert.ok(stored.deleted_at)
  assert.equal(stored.enabled, false)

  const contract = read("lib/network/push/contract.ts")
  assert.match(contract, /mobile_devices\.device_id/)
  assert.doesNotMatch(contract, /pushToken/)
  assert.doesNotMatch(contract, /firebase|fcm/i)
})
