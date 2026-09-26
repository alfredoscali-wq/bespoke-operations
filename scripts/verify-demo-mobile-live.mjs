/**
 * Live verification for Demo Mobile 1.0.
 * Reads Demo tenant + Mobile API. Does not complete commercial OTs.
 * Does not mutate ABNet.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { createClient } from "@supabase/supabase-js"

import {
  BESPOKE_DEMO_COMPANY_ID,
  DEMO_MOBILE_COMPANY_CODE,
  DEMO_MOBILE_CREW_NAME,
  DEMO_MOBILE_DEVICE_ID,
  DEMO_MOBILE_TASK_CODES,
  DEMO_OPERARIO_EMAIL,
} from "../lib/demo/constants.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"

const root = resolve(import.meta.dirname, "..")
const env = readFileSync(resolve(root, ".env.local"), "utf8")

function envValue(key) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, "m"))
  return match?.[1]?.trim() ?? ""
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL")
const key = envValue("SUPABASE_SERVICE_ROLE_KEY")
const password = envValue("DEMO_MOBILE_PASSWORD") || envValue("DEMO_OPERARIO_PASSWORD")
const origin = process.env.DEMO_VERIFY_ORIGIN || "http://localhost:3000"

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

test("live: Demo company has mobile_code and settings; ABNet code unchanged", async () => {
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, mobile_code")
    .in("id", [BESPOKE_DEMO_COMPANY_ID, BESPOKE_PRODUCTION_COMPANY_ID])

  assert.equal(error, null)
  const demo = companies.find((row) => row.id === BESPOKE_DEMO_COMPANY_ID)
  const production = companies.find((row) => row.id === BESPOKE_PRODUCTION_COMPANY_ID)
  assert.equal(demo?.name, "Bespoke Demo")
  assert.equal(demo?.mobile_code, DEMO_MOBILE_COMPANY_CODE)
  assert.equal(production?.mobile_code, "abnet-7k5g")

  const { data: settings } = await supabase
    .from("company_mobile_settings")
    .select(
      "shift_location_validation_enabled, task_location_validation_enabled, gps_heartbeat_enabled, gps_heartbeat_interval_seconds, shift_radius_meters, task_radius_meters"
    )
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .maybeSingle()

  assert.equal(settings?.shift_location_validation_enabled, false)
  assert.equal(settings?.task_location_validation_enabled, false)
  assert.equal(settings?.gps_heartbeat_enabled, true)
  assert.equal(settings?.gps_heartbeat_interval_seconds, 60)
  assert.equal(settings?.shift_radius_meters, 150)
  assert.equal(settings?.task_radius_meters, 150)

  const { count } = await supabase
    .from("company_mobile_settings")
    .select("company_id", { count: "exact", head: true })
    .eq("company_id", BESPOKE_PRODUCTION_COMPANY_ID)
  assert.ok((count ?? 0) >= 0)
})

test("live: operario, crew, device and DEMO-MOBILE OTs exist only in Demo", async () => {
  const { data: employee } = await supabase
    .from("employees")
    .select("id, company_id, email, system_access, system_role")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("email", DEMO_OPERARIO_EMAIL)
    .is("deleted_at", null)
    .maybeSingle()

  assert.equal(employee?.system_access, true)
  assert.equal(employee?.system_role, "operario")
  assert.equal(employee?.company_id, BESPOKE_DEMO_COMPANY_ID)

  const { data: crew } = await supabase
    .from("crews")
    .select("id, company_id, status, operational_base_latitude")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("name", DEMO_MOBILE_CREW_NAME)
    .is("deleted_at", null)
    .maybeSingle()

  assert.equal(crew?.status, "activa")
  assert.ok(crew?.operational_base_latitude != null)

  const { data: member } = await supabase
    .from("crew_members")
    .select("id")
    .eq("crew_id", crew.id)
    .eq("employee_id", employee.id)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle()
  assert.ok(member)

  const { data: device } = await supabase
    .from("mobile_devices")
    .select("company_id, work_team_id, status")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("device_id", DEMO_MOBILE_DEVICE_ID)
    .is("deleted_at", null)
    .maybeSingle()

  assert.equal(device?.status, "ACTIVE")
  assert.equal(device?.work_team_id, crew.id)

  const { data: tasks } = await supabase
    .from("tasks")
    .select("code, company_id, status, crew_id")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .in("code", [...DEMO_MOBILE_TASK_CODES])
    .is("deleted_at", null)

  assert.equal(tasks?.length, 3)
  for (const task of tasks) {
    assert.equal(task.status, "asignada")
    assert.equal(task.crew_id, crew.id)
    assert.equal(task.company_id, BESPOKE_DEMO_COMPANY_ID)
  }

  const { count: leaked } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("company_id", BESPOKE_PRODUCTION_COMPANY_ID)
    .like("code", "DEMO-MOBILE-%")
  assert.equal(leaked ?? 0, 0)
})

test("live: bootstrap + login + jornada + agenda + heartbeat via Mobile API", async () => {
  const demoPage = await fetch(`${origin}/demo`)
  assert.equal(demoPage.status, 200)
  const demoHtml = await demoPage.text()
  assert.match(demoHtml, /Demo interactiva/)
  assert.doesNotMatch(demoHtml, /abnet-7k5g|app-abnet|ABNet/)

  const bootstrapResponse = await fetch(`${origin}/api/mobile/v1/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyCode: "DEMO-8F4K" }),
  })
  const bootstrapJson = await bootstrapResponse.json()
  assert.equal(bootstrapResponse.status, 200, JSON.stringify(bootstrapJson))
  assert.equal(bootstrapJson.data.companyId, BESPOKE_DEMO_COMPANY_ID)
  assert.equal(bootstrapJson.data.companyName, "Bespoke Demo")
  assert.equal(bootstrapJson.data.operations.shiftLocationValidationEnabled, false)
  assert.equal(bootstrapJson.data.operations.gpsHeartbeatEnabled, true)
  assert.equal(bootstrapJson.data.operations.gpsHeartbeatIntervalSeconds, 60)

  const loginResponse = await fetch(`${origin}/api/mobile/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: DEMO_OPERARIO_EMAIL,
      password,
      deviceId: DEMO_MOBILE_DEVICE_ID,
      appVersion: "1.0.0",
      platform: "android",
    }),
  })
  const loginJson = await loginResponse.json()
  assert.equal(loginResponse.status, 200, JSON.stringify(loginJson))
  assert.equal(loginJson.data.user.companyId, BESPOKE_DEMO_COMPANY_ID)
  assert.notEqual(loginJson.data.user.companyId, BESPOKE_PRODUCTION_COMPANY_ID)
  assert.equal(loginJson.data.user.email, DEMO_OPERARIO_EMAIL)

  const token = loginJson.data.accessToken
  const authHeaders = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  }
  const gps = { latitude: -34.572, longitude: -58.423 }

  await fetch(`${origin}/api/mobile/v1/shifts/finish`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ deviceId: DEMO_MOBILE_DEVICE_ID, ...gps }),
  })

  const startShift = await fetch(`${origin}/api/mobile/v1/shifts/start`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ deviceId: DEMO_MOBILE_DEVICE_ID, ...gps }),
  })
  const startShiftJson = await startShift.json()
  assert.equal(startShift.status, 200, JSON.stringify(startShiftJson))

  const { data: demoTasks } = await supabase
    .from("tasks")
    .select("id, code, title, status")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("code", "DEMO-MOBILE-001")
    .is("deleted_at", null)
    .maybeSingle()
  assert.equal(demoTasks?.status, "asignada")

  const agendaResponse = await fetch(
    `${origin}/api/mobile/v1/agenda/today?deviceId=${encodeURIComponent(DEMO_MOBILE_DEVICE_ID)}`,
    { headers: { authorization: `Bearer ${token}` } }
  )
  const agendaJson = await agendaResponse.json()
  assert.equal(agendaResponse.status, 200, JSON.stringify(agendaJson))
  assert.equal(agendaJson.data.shiftActive, true)

  const detailResponse = await fetch(
    `${origin}/api/mobile/v1/tasks/${demoTasks.id}?deviceId=${encodeURIComponent(DEMO_MOBILE_DEVICE_ID)}`,
    { headers: { authorization: `Bearer ${token}` } }
  )
  const detailJson = await detailResponse.json()
  assert.equal(detailResponse.status, 200, JSON.stringify(detailJson))
  assert.match(JSON.stringify(detailJson), /Instalación de cliente|DEMO-MOBILE-001/)
  assert.match(JSON.stringify(detailJson), /checklist|Verificar instalación/)

  const heartbeat = await fetch(`${origin}/api/mobile/v1/gps/heartbeat`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      deviceId: DEMO_MOBILE_DEVICE_ID,
      ...gps,
      accuracyMeters: 12,
      timestamp: new Date().toISOString(),
    }),
  })
  const heartbeatJson = await heartbeat.json()
  assert.equal(heartbeat.status, 200, JSON.stringify(heartbeatJson))

  const finishShift = await fetch(`${origin}/api/mobile/v1/shifts/finish`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ deviceId: DEMO_MOBILE_DEVICE_ID, ...gps }),
  })
  const finishJson = await finishShift.json()
  assert.equal(finishShift.status, 200, JSON.stringify(finishJson))

  const blockedHeartbeat = await fetch(`${origin}/api/mobile/v1/gps/heartbeat`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      deviceId: DEMO_MOBILE_DEVICE_ID,
      ...gps,
      accuracyMeters: 12,
      timestamp: new Date().toISOString(),
    }),
  })
  const blockedJson = await blockedHeartbeat.json()
  assert.equal(blockedHeartbeat.status, 409)
  assert.equal(blockedJson.error?.code, "SHIFT_NOT_ACTIVE")
})
