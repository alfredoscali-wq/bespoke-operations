/**
 * Read-only audit of Bespoke Demo tenant. Does not mutate ABNet or Demo.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const DEMO = "00000000-0000-4000-8000-000000000001"
const ABNET = "00000000-0000-4000-8000-000000000002"

function loadEnv() {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  if (!url || !key) throw new Error("Missing Supabase env")
  return { url, key }
}

function hasChecklist(task) {
  const meta = task.task_metadata
  const template = meta?.operationalChecklistTemplate
  const classic = Array.isArray(task.checklist) ? task.checklist : []
  return (Array.isArray(template) && template.length > 0) || classic.length > 0
}

function inCordoba(lat, lng) {
  if (lat == null || lng == null) return false
  return lat < -31.2 && lat > -31.6 && lng < -64.0 && lng > -64.4
}

function inBuenosAires(lat, lng) {
  if (lat == null || lng == null) return false
  return lat < -34.3 && lat > -34.9 && lng < -58.2 && lng > -58.7
}

const { url, key } = loadEnv()
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { count: abnetTasks } = await supabase
  .from("tasks")
  .select("id", { count: "exact", head: true })
  .eq("company_id", ABNET)
  .is("deleted_at", null)

const { data: company } = await supabase
  .from("companies")
  .select("id, name, display_name, slug, mobile_code")
  .eq("id", DEMO)
  .maybeSingle()

const { data: branding } = await supabase
  .from("company_branding")
  .select("company_id, logo_url, primary_color, secondary_color")
  .eq("company_id", DEMO)
  .maybeSingle()

const { data: mobileSettings } = await supabase
  .from("company_mobile_settings")
  .select("*")
  .eq("company_id", DEMO)
  .maybeSingle()

const { data: customers } = await supabase
  .from("customers")
  .select("id, name, phone, locality, latitude, longitude, external_customer_code, status")
  .eq("company_id", DEMO)
  .is("deleted_at", null)

const { data: employees } = await supabase
  .from("employees")
  .select("id, employee_code, first_name, last_name, employee_type, system_role, system_access, email")
  .eq("company_id", DEMO)
  .is("deleted_at", null)

const { data: crews } = await supabase
  .from("crews")
  .select(
    "id, name, status, operational_base_name, operational_base_address, operational_base_latitude, operational_base_longitude"
  )
  .eq("company_id", DEMO)
  .is("deleted_at", null)

const { data: members } = await supabase
  .from("crew_members")
  .select("id, crew_id, employee_id, name, role, active")
  .in("crew_id", (crews ?? []).map((c) => c.id))
  .is("deleted_at", null)

const { data: projects } = await supabase
  .from("projects")
  .select("id, code, name, client, status, location")
  .eq("company_id", DEMO)
  .is("deleted_at", null)

const { data: tasks } = await supabase
  .from("tasks")
  .select(
    "id, code, title, status, project_id, project_code, crew, crew_id, start_date, due_date, latitude, longitude, locality, service_address, service_type, checklist, task_metadata, customer_name"
  )
  .eq("company_id", DEMO)
  .is("deleted_at", null)
  .order("code")

const { data: devices } = await supabase
  .from("mobile_devices")
  .select("id, device_id, work_team_id, status, model, last_seen_at")
  .eq("company_id", DEMO)
  .is("deleted_at", null)

const { data: shifts } = await supabase
  .from("work_team_shifts")
  .select("id, work_team_id, status, started_at, finished_at")
  .eq("company_id", DEMO)
  .eq("status", "ACTIVE")

const { data: locations } = await supabase
  .from("company_work_team_locations")
  .select("work_team_id, latitude, longitude, captured_at")
  .eq("company_id", DEMO)

const taskIds = (tasks ?? []).map((t) => t.id)
const { count: evidenceCount } = await supabase
  .from("evidences")
  .select("id", { count: "exact", head: true })
  .eq("company_id", DEMO)

const { count: photoCount } = taskIds.length
  ? await supabase
      .from("task_photos")
      .select("id", { count: "exact", head: true })
      .in("task_id", taskIds)
      .is("deleted_at", null)
  : { count: 0 }

const { data: woChecklist } = await supabase
  .from("work_order_type_checklist_items")
  .select("id, title, field_type, service_type")
  .eq("company_id", DEMO)

const statusCounts = {}
const codePrefixes = {}
let withProject = 0
let withoutProject = 0
let withChecklist = 0
let cordobaGps = 0
let baGps = 0
let noGps = 0
const examplesByStatus = {}

for (const task of tasks ?? []) {
  statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1
  const prefix = String(task.code ?? "").split("-").slice(0, 2).join("-")
  codePrefixes[prefix] = (codePrefixes[prefix] ?? 0) + 1
  if (task.project_id) withProject += 1
  else withoutProject += 1
  if (hasChecklist(task)) withChecklist += 1
  if (task.latitude == null || task.longitude == null) noGps += 1
  else if (inCordoba(task.latitude, task.longitude)) cordobaGps += 1
  else if (inBuenosAires(task.latitude, task.longitude)) baGps += 1
  if (!examplesByStatus[task.status]) {
    examplesByStatus[task.status] = {
      code: task.code,
      title: task.title,
      project: task.project_code,
      crew: task.crew,
      due: task.due_date,
      lat: task.latitude,
      lng: task.longitude,
    }
  }
}

const activeListStatuses = [
  "programada",
  "asignada",
  "en-curso",
  "pendiente-cierre",
  "vencida",
]
const dashboardOperational = [
  "borrador",
  "programada",
  "asignada",
  "en-curso",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
]

const tareasVisible = (tasks ?? []).filter(
  (t) => !t.project_id && activeListStatuses.includes(t.status)
)
const dashboardPending = (tasks ?? []).filter((t) =>
  dashboardOperational.includes(t.status)
)
const planningVisible = (tasks ?? []).filter((t) =>
  [
    "programada",
    "asignada",
    "en-curso",
    "vencida",
    "incidencia",
    "pendiente-cierre",
    "en-aprobacion",
  ].includes(t.status)
)
const assignedToday = (tasks ?? []).filter((t) => t.status === "asignada")
const mobileCodes = (tasks ?? []).filter((t) =>
  String(t.code ?? "").startsWith("DEMO-MOBILE-")
)

const report = {
  company,
  branding,
  mobileSettings: mobileSettings
    ? {
        gps_heartbeat_enabled: mobileSettings.gps_heartbeat_enabled,
        gps_heartbeat_interval_seconds:
          mobileSettings.gps_heartbeat_interval_seconds,
        shift_location_validation_enabled:
          mobileSettings.shift_location_validation_enabled,
        task_location_validation_enabled:
          mobileSettings.task_location_validation_enabled,
      }
    : null,
  counts: {
    customers: customers?.length ?? 0,
    employees: employees?.length ?? 0,
    crews: crews?.length ?? 0,
    crewMembers: members?.length ?? 0,
    projects: projects?.length ?? 0,
    tasks: tasks?.length ?? 0,
    devices: devices?.length ?? 0,
    activeShifts: shifts?.length ?? 0,
    liveLocations: locations?.length ?? 0,
    evidences: evidenceCount ?? 0,
    taskPhotos: photoCount ?? 0,
    workOrderTypeChecklistItems: woChecklist?.length ?? 0,
    abnetTasksUnchangedProbe: abnetTasks,
  },
  customersSample: (customers ?? []).slice(0, 5).map((c) => ({
    name: c.name,
    phone: c.phone,
    locality: c.locality,
    lat: c.latitude,
    lng: c.longitude,
    code: c.external_customer_code,
  })),
  employees: (employees ?? []).map((e) => ({
    code: e.employee_code,
    name: `${e.first_name} ${e.last_name}`,
    type: e.employee_type,
    role: e.system_role,
    access: e.system_access,
    email: e.email,
  })),
  crews: (crews ?? []).map((c) => ({
    name: c.name,
    status: c.status,
    base: c.operational_base_name,
    address: c.operational_base_address,
    lat: c.operational_base_latitude,
    lng: c.operational_base_longitude,
    members: (members ?? [])
      .filter((m) => m.crew_id === c.id)
      .map((m) => `${m.name} (${m.role}${m.active ? "" : ", inactive"})`),
  })),
  projects: (projects ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    client: p.client,
    status: p.status,
    location: p.location,
  })),
  devices,
  activeShifts: shifts,
  liveLocations: locations,
  taskBreakdown: {
    statusCounts,
    codePrefixes,
    withProject,
    withoutProject,
    withChecklist,
    cordobaGps,
    baGps,
    noGps,
    examplesByStatus,
  },
  surfaceMismatch: {
    dashboardPendingCount: dashboardPending.length,
    tareasListCount: tareasVisible.length,
    planningCount: planningVisible.length,
    assignedCount: assignedToday.length,
    dashboardNotInTareas: dashboardPending.length - tareasVisible.length,
  },
  mobileTasks: mobileCodes.map((t) => ({
    code: t.code,
    title: t.title,
    status: t.status,
    project: t.project_code,
    projectId: t.project_id,
    crew: t.crew,
    due: t.due_date,
    start: t.start_date,
    lat: t.latitude,
    lng: t.longitude,
    checklist: hasChecklist(t),
    checklistCount: Array.isArray(t.task_metadata?.operationalChecklistTemplate)
      ? t.task_metadata.operationalChecklistTemplate.length
      : 0,
  })),
  tareasVisibleSample: tareasVisible.slice(0, 8).map((t) => ({
    code: t.code,
    status: t.status,
    title: t.title,
  })),
}

console.log(JSON.stringify(report, null, 2))
