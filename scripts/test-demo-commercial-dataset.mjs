/**
 * Demo commercial dataset — live tenant checks.
 * Read-only against Demo. Does not mutate ABNet.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { createClient } from "@supabase/supabase-js"

import {
  DEMO_COMPANY_CHECKLISTS,
  DEMO_CUSTOMERS,
  DEMO_FIELD_TASKS,
  DEMO_LIVE_TASK_CODE,
  isDemoCordobaCoordinate,
} from "../lib/demo/commercial-dataset.ts"
import {
  BESPOKE_DEMO_COMPANY_ID,
  DEMO_COMMERCIAL_USERNAME,
  DEMO_MOBILE_COMPANY_CODE,
  DEMO_MOBILE_CREW_NAME,
  DEMO_MOBILE_DEVICE_ID,
  DEMO_MOBILE_TASK_CODES,
} from "../lib/demo/constants.ts"
import { resolveDemoCommercialAuthEmail } from "../lib/demo/login-alias.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"
import { getTransitionForAction } from "../lib/tasks/task-status-workflow.ts"
import {
  ACTIVE_WORK_ORDER_LIST_STATUSES,
  DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES,
  PLANNING_WORK_ORDER_LIST_STATUSES,
} from "../lib/tasks/task-list-scope.ts"

const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
if (!url || !key) {
  throw new Error("Missing Supabase env")
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

test("1. Dashboard Demo has operational OTs that also appear in Tareas", async () => {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("code, status, project_id, deleted_at, due_date")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .is("deleted_at", null)

  assert.equal(error, null)
  const dashboard = (tasks ?? []).filter((task) =>
    DASHBOARD_OPERATIONAL_WORK_ORDER_LIST_STATUSES.includes(task.status)
  )
  const tareas = (tasks ?? []).filter(
    (task) =>
      !task.project_id && ACTIVE_WORK_ORDER_LIST_STATUSES.includes(task.status)
  )
  assert.ok(dashboard.length >= 8, `dashboard operational ${dashboard.length}`)
  assert.ok(tareas.length >= 8, `tareas list ${tareas.length}`)
  const dashboardField = dashboard.filter((task) => !task.project_id)
  for (const task of dashboardField) {
    if (ACTIVE_WORK_ORDER_LIST_STATUSES.includes(task.status)) {
      assert.ok(
        tareas.some((item) => item.code === task.code),
        `${task.code} is on Dashboard but missing from Tareas`
      )
    }
  }
})

test("2. Planning has Demo OTs", async () => {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("code, status, project_id")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .is("deleted_at", null)

  const planning = (tasks ?? []).filter((task) =>
    PLANNING_WORK_ORDER_LIST_STATUSES.includes(task.status)
  )
  assert.ok(planning.some((task) => task.status === "programada"))
  assert.ok(planning.length >= 8)
})

test("3. Mobile crew has assigned OTs with Córdoba GPS and checklists", async () => {
  const { data: crew } = await supabase
    .from("crews")
    .select("id, operational_base_latitude, operational_base_longitude")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("name", DEMO_MOBILE_CREW_NAME)
    .maybeSingle()

  assert.ok(crew)
  assert.ok(
    isDemoCordobaCoordinate(
      crew.operational_base_latitude,
      crew.operational_base_longitude
    )
  )

  const { data: tasks } = await supabase
    .from("tasks")
    .select("code, status, crew_id, latitude, longitude, project_id, service_type")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .in("code", [...DEMO_MOBILE_TASK_CODES])
    .is("deleted_at", null)

  assert.equal(tasks?.length, 3)
  for (const task of tasks ?? []) {
    assert.equal(task.status, "asignada")
    assert.equal(task.crew_id, crew.id)
    assert.equal(task.project_id, null)
    assert.ok(isDemoCordobaCoordinate(task.latitude, task.longitude))
  }

  const { count } = await supabase
    .from("work_order_type_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
  assert.ok((count ?? 0) >= DEMO_COMPANY_CHECKLISTS.flatMap((item) => item.items).length)
})

test("4. Live demo OT can follow the official start → submit → approve workflow", async () => {
  assert.equal(DEMO_LIVE_TASK_CODE, "DEMO-MOBILE-001")
  assert.deepEqual(getTransitionForAction("start"), {
    from: ["asignada"],
    to: "en-curso",
  })
  assert.deepEqual(getTransitionForAction("submit-for-approval"), {
    from: ["en-curso"],
    to: "pendiente-cierre",
  })
  assert.equal(getTransitionForAction("approve").to, "finalizada")

  const { data: live } = await supabase
    .from("tasks")
    .select("code, status, project_id, crew_id")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("code", DEMO_LIVE_TASK_CODE)
    .is("deleted_at", null)
    .maybeSingle()
  assert.equal(live?.status, "asignada")
  assert.equal(live?.project_id, null)
})

test("5. Device, company code and commercial alias stay Demo-only", async () => {
  const { data: device } = await supabase
    .from("mobile_devices")
    .select("company_id, device_id, status")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("device_id", DEMO_MOBILE_DEVICE_ID)
    .maybeSingle()
  assert.equal(device?.status, "ACTIVE")

  const { data: companies } = await supabase
    .from("companies")
    .select("id, mobile_code")
    .in("id", [BESPOKE_DEMO_COMPANY_ID, BESPOKE_PRODUCTION_COMPANY_ID])
  const demo = companies?.find((row) => row.id === BESPOKE_DEMO_COMPANY_ID)
  const abnet = companies?.find((row) => row.id === BESPOKE_PRODUCTION_COMPANY_ID)
  assert.equal(demo?.mobile_code, DEMO_MOBILE_COMPANY_CODE)
  assert.equal(abnet?.mobile_code, "abnet-7k5g")
  assert.equal(DEMO_COMMERCIAL_USERNAME, "bes-demo")
  assert.equal(resolveDemoCommercialAuthEmail("bes-demo", "web")?.includes("demo@"), true)
  assert.equal(
    resolveDemoCommercialAuthEmail("bes-demo", "mobile")?.includes("operario"),
    true
  )
})

test("6. Seed markers are unique; customers and field OTs are not the old 100/250 set", async () => {
  const { data: customers } = await supabase
    .from("customers")
    .select("external_customer_code, latitude, longitude, phone")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .like("external_customer_code", "DEMO-SEED-%")
    .is("deleted_at", null)
  assert.equal(customers?.length, DEMO_CUSTOMERS.length)
  const codes = new Set((customers ?? []).map((row) => row.external_customer_code))
  assert.equal(codes.size, DEMO_CUSTOMERS.length)
  for (const customer of customers ?? []) {
    assert.ok(isDemoCordobaCoordinate(customer.latitude, customer.longitude))
    assert.match(customer.phone ?? "", /351/)
  }

  const { data: fieldTasks } = await supabase
    .from("tasks")
    .select("code")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .like("code", "DEMO-OT-%")
    .is("deleted_at", null)
  assert.equal(fieldTasks?.length, DEMO_FIELD_TASKS.length)

  const { count: leaked } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("company_id", BESPOKE_PRODUCTION_COMPANY_ID)
    .like("code", "DEMO-OT-%")
  assert.equal(leaked ?? 0, 0)
})

test("7. Demo branding exists; ABNet branding row is not rewritten by Demo constants", async () => {
  const { data: demoBranding } = await supabase
    .from("company_branding")
    .select("logo_url, primary_color, secondary_color")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .maybeSingle()
  assert.ok(demoBranding?.logo_url)
  assert.equal(demoBranding?.primary_color, "#FF6E3D")
  assert.equal(demoBranding?.secondary_color, "#05D6B3")

  const { data: abnetBranding } = await supabase
    .from("company_branding")
    .select("company_id, logo_url")
    .eq("company_id", BESPOKE_PRODUCTION_COMPANY_ID)
    .maybeSingle()
  assert.notEqual(abnetBranding?.logo_url ?? "abnet", demoBranding.logo_url)
})
