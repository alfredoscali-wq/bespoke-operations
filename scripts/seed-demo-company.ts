import { readFileSync } from "fs"
import { resolve } from "path"

import { createClient } from "@supabase/supabase-js"

import {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_DEMO_COMPANY_NAME,
  BESPOKE_DEMO_COMPANY_SLUG,
  DEMO_ADMIN_EMAIL,
  DEMO_SEED_MARKER,
} from "@/lib/demo/constants"
import {
  DEMO_ADMIN_PASSWORD,
  ensureDemoAdminAccount,
} from "@/lib/demo/ensure-demo-admin-account"
import type { Database } from "@/lib/supabase/database.types"

const CUSTOMER_COUNT = 250
const EMPLOYEE_COUNT = 20
const CREW_COUNT = 6
const PROJECT_COUNT = 10
const TASK_COUNT = 100
const AUDIT_LOG_COUNT = 60
const REPORT_HISTORY_COUNT = 12

const LOCALITIES = [
  "Ciudad Norte",
  "Ciudad Sur",
  "Centro",
  "Zona Este",
  "Zona Oeste",
  "Parque Industrial",
]

const TASK_STATUSES = [
  "pendiente",
  "asignada",
  "en-curso",
  "pendiente-cierre",
  "finalizada",
  "cerrada",
  "cancelada",
  "incidencia",
  "vencida",
  "en-aprobacion",
] as const

const TASK_TYPES = ["maintenance", "inspection"] as const

type SupabaseAdmin = ReturnType<typeof createClient<Database>>

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  return { url, key }
}

function pad(num: number, size = 3) {
  return String(num).padStart(size, "0")
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function resetDemoDataDirect(supabase: SupabaseAdmin) {
  const companyId = BESPOKE_DEMO_COMPANY_ID

  await supabase
    .from("automatic_report_history")
    .delete()
    .eq("generated_by", "Demo Seed")

  await supabase
    .from("system_audit_log")
    .delete()
    .contains("metadata", { demoSeed: true })

  const { data: demoTasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("company_id", companyId)
    .like("code", "DEMO-%")

  const demoTaskIds = (demoTasks ?? []).map((task) => task.id)

  if (demoTaskIds.length > 0) {
    await supabase.from("task_photos").delete().in("task_id", demoTaskIds)
    await supabase.from("evidences").delete().in("task_id", demoTaskIds)
  }

  await supabase
    .from("evidences")
    .delete()
    .eq("company_id", companyId)
    .like("file_name", "demo-seed-%")

  await supabase.from("tasks").delete().eq("company_id", companyId).like("code", "DEMO-%")

  const { data: demoCrews } = await supabase
    .from("crews")
    .select("id")
    .eq("company_id", companyId)
    .like("name", "Cuadrilla Demo %")

  const demoCrewIds = (demoCrews ?? []).map((crew) => crew.id)

  if (demoCrewIds.length > 0) {
    await supabase.from("crew_members").delete().in("crew_id", demoCrewIds)
  }

  await supabase.from("crews").delete().eq("company_id", companyId).like("name", "Cuadrilla Demo %")

  const { data: demoProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("company_id", companyId)
    .like("code", "DEMO-OB-%")

  const demoProjectIds = (demoProjects ?? []).map((project) => project.id)

  if (demoProjectIds.length > 0) {
    await supabase.from("project_history").delete().in("project_id", demoProjectIds)
  }

  await supabase
    .from("projects")
    .delete()
    .eq("company_id", companyId)
    .like("code", "DEMO-OB-%")

  await supabase
    .from("employee_availability")
    .delete()
    .eq("company_id", companyId)
    .like("reason", "Demo Seed%")

  await supabase
    .from("employees")
    .delete()
    .eq("company_id", companyId)
    .like("employee_code", "DEMO-EMP-%")

  await supabase
    .from("customers")
    .delete()
    .eq("company_id", companyId)
    .like("external_customer_code", `${DEMO_SEED_MARKER}-%`)
}

async function ensureDemoCompany(supabase: SupabaseAdmin) {
  const { error } = await supabase.from("companies").upsert(
    {
      id: BESPOKE_DEMO_COMPANY_ID,
      name: BESPOKE_DEMO_COMPANY_NAME,
      slug: BESPOKE_DEMO_COMPANY_SLUG,
    },
    { onConflict: "id" }
  )

  if (error) {
    throw new Error(`Failed to upsert demo company: ${error.message}`)
  }
}

async function seedCustomers(supabase: SupabaseAdmin) {
  const rows = Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const number = index + 1
    const locality = LOCALITIES[index % LOCALITIES.length]

    return {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      customer_number: `${DEMO_SEED_MARKER}-${pad(number, 4)}`,
      external_customer_code: `${DEMO_SEED_MARKER}-${pad(number, 4)}`,
      name: `Cliente Demo ${pad(number, 3)}`,
      phone: `+54 11 4000-${pad(number % 10000, 4)}`,
      email: `cliente.demo.${number}@example.com`,
      address: `Av. Comercial ${100 + number}`,
      locality,
      technology: "Servicio estándar",
      status: number % 17 === 0 ? "inactivo" : "activo",
      validation_status: "active",
      latitude: -34.6 + (index % 10) * 0.01,
      longitude: -58.4 + (index % 10) * 0.01,
    }
  })

  for (const batch of chunk(rows, 50)) {
    const { error } = await supabase.from("customers").insert(batch)
    if (error) {
      throw new Error(`Failed to seed customers: ${error.message}`)
    }
  }

  const { data, error: loadError } = await supabase
    .from("customers")
    .select("id, name, phone, address, locality, external_customer_code")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .like("external_customer_code", `${DEMO_SEED_MARKER}-%`)
    .order("external_customer_code", { ascending: true })

  if (loadError || !data) {
    throw new Error(loadError?.message ?? "Failed to load seeded customers")
  }

  return data
}

async function seedEmployees(supabase: SupabaseAdmin) {
  const firstNames = [
    "Ana",
    "Bruno",
    "Carla",
    "Diego",
    "Elena",
    "Felipe",
    "Gabriela",
    "Hugo",
    "Inés",
    "Javier",
    "Karina",
    "Leo",
    "Marina",
    "Nico",
    "Olivia",
    "Pablo",
    "Renata",
    "Sergio",
    "Teresa",
    "Ulises",
  ]

  const lastNames = [
    "Acosta",
    "Benítez",
    "Castro",
    "Domínguez",
    "Escobar",
    "Fernández",
    "García",
    "Herrera",
    "Ibarra",
    "Juárez",
    "López",
    "Méndez",
    "Navarro",
    "Ortega",
    "Paredes",
    "Quintana",
    "Ríos",
    "Salazar",
    "Torres",
    "Vega",
  ]

  const rows = Array.from({ length: EMPLOYEE_COUNT }, (_, index) => {
    const number = index + 1
    const isSupervisor = number <= 3

    return {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      employee_code: `DEMO-EMP-${pad(number, 2)}`,
      first_name: firstNames[index],
      last_name: lastNames[index],
      job_title: isSupervisor ? "Supervisor de operaciones" : "Operario de campo",
      department: "Operaciones",
      employee_type: isSupervisor ? "supervisor" : "operario",
      employment_status: number === 20 ? "vacation" : "active",
      email: `empleado.demo.${number}@example.com`,
      phone: `+54 11 5000-${pad(number, 4)}`,
      notes: `${DEMO_SEED_MARKER} employee`,
      system_role: isSupervisor ? "supervisor" : "operario",
      system_access: false,
    }
  })

  const { data, error } = await supabase
    .from("employees")
    .insert(rows as Database["public"]["Tables"]["employees"]["Insert"][])
    .select("id, first_name, last_name, employee_code, employee_type")

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to seed employees")
  }

  return data
}

async function seedCrews(
  supabase: SupabaseAdmin,
  employees: { id: string; first_name: string; last_name: string; employee_code: string; employee_type: string }[]
) {
  const supervisors = employees.filter((employee) => employee.employee_type === "supervisor")
  const operarios = employees.filter((employee) => employee.employee_type === "operario")

  const crewRows = Array.from({ length: CREW_COUNT }, (_, index) => {
    const supervisor = supervisors[index % supervisors.length]
    const supervisorName = `${supervisor.first_name} ${supervisor.last_name}`

    return {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      name: `Cuadrilla Demo ${index + 1}`,
      description: "Cuadrilla de demostración comercial",
      supervisor: supervisorName,
      supervisor_employee_id: supervisor.id,
      status: index === CREW_COUNT - 1 ? "inactiva" : "activa",
      notes: DEMO_SEED_MARKER,
    }
  })

  const { data: crews, error } = await supabase
    .from("crews")
    .insert(crewRows as Database["public"]["Tables"]["crews"]["Insert"][])
    .select("id, name, supervisor, supervisor_employee_id")

  if (error || !crews) {
    throw new Error(error?.message ?? "Failed to seed crews")
  }

  const memberRows = crews.flatMap((crew, crewIndex) => {
    const sliceStart = crewIndex * 3
    const members = operarios.slice(sliceStart, sliceStart + 3)

    return members.map((member) => ({
      crew_id: crew.id,
      employee_id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      role: "Operario",
      active: true,
    }))
  })

  const { error: memberError } = await supabase.from("crew_members").insert(memberRows)

  if (memberError) {
    throw new Error(`Failed to seed crew members: ${memberError.message}`)
  }

  return crews
}

async function seedProjects(
  supabase: SupabaseAdmin,
  customers: { name: string }[],
  supervisors: { first_name: string; last_name: string }[]
) {
  const projectNames = [
    "Obra Centro",
    "Obra Norte",
    "Obra Sur",
    "Obra Parque",
    "Obra Residencial A",
    "Obra Residencial B",
    "Obra Comercial A",
    "Obra Comercial B",
    "Obra Mantenimiento A",
    "Obra Mantenimiento B",
  ]

  const today = new Date()

  const rows = projectNames.map((name, index) => {
    const supervisor = supervisors[index % supervisors.length]
    const status =
      index < 6 ? "active" : index < 8 ? "planned" : index === 8 ? "paused" : "closed"

    return {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      code: `DEMO-OB-${pad(index + 1, 2)}`,
      name,
      client: customers[index * 5]?.name ?? "Cliente Demo 001",
      type: "maintenance",
      status,
      progress: [12, 28, 45, 60, 72, 85, 5, 10, 35, 100][index],
      supervisor: `${supervisor.first_name} ${supervisor.last_name}`,
      location: LOCALITIES[index % LOCALITIES.length],
      description: "Obra de demostración para recorrido comercial.",
      start_date: toDateOnly(addDays(today, -90 + index * 5)),
      end_date: toDateOnly(addDays(today, 120 + index * 10)),
    }
  })

  const { data, error } = await supabase
    .from("projects")
    .insert(rows as Database["public"]["Tables"]["projects"]["Insert"][])
    .select("id, code, name, client, supervisor")

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to seed projects")
  }

  const historyRows = data.flatMap((project) => [
    {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      project_id: project.id,
      event_type: "created",
      title: "Alta de obra",
      description: `Obra ${project.code} registrada en el sistema demo.`,
      metadata: { demoSeed: true },
    },
    {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      project_id: project.id,
      event_type: "updated",
      title: "Actualización operativa",
      description: "Se actualizaron datos operativos de la obra demo.",
      metadata: { demoSeed: true },
    },
  ])

  const { error: historyError } = await supabase.from("project_history").insert(historyRows)

  if (historyError) {
    throw new Error(`Failed to seed project history: ${historyError.message}`)
  }

  return data
}

async function seedTasks(
  supabase: SupabaseAdmin,
  customers: {
    id: string
    name: string
    phone: string | null
    address: string | null
    locality: string | null
  }[],
  projects: { id: string; code: string; name: string; supervisor: string }[],
  crews: { id: string; name: string }[]
) {
  const today = new Date()
  const rows: Database["public"]["Tables"]["tasks"]["Insert"][] = Array.from(
    { length: TASK_COUNT },
    (_, index) => {
    const number = index + 1
    const customer = customers[index % customers.length]
    const project = projects[index % projects.length]
    const crew = crews[index % crews.length]
    const status = TASK_STATUSES[index % TASK_STATUSES.length]
    const scheduledOffset = (index % 21) - 10

    return {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      code: `DEMO-OT-${pad(number, 3)}`,
      title: `Orden de servicio ${pad(number, 3)}`,
      description: "Orden de trabajo demo para recorrido comercial.",
      project_id: project.id,
      project_code: project.code,
      project_name: project.name,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      service_address: customer.address,
      locality: customer.locality,
      latitude: -34.6 + (index % 15) * 0.008,
      longitude: -58.4 + (index % 15) * 0.008,
      type: TASK_TYPES[index % TASK_TYPES.length],
      status,
      priority: index % 5 === 0 ? "alta" : index % 3 === 0 ? "baja" : "media",
      supervisor: project.supervisor,
      crew_id: ["cancelada", "pendiente"].includes(status) ? null : crew.id,
      crew: ["cancelada", "pendiente"].includes(status) ? "" : crew.name,
      start_date: toDateOnly(addDays(today, scheduledOffset - 2)),
      due_date: toDateOnly(addDays(today, scheduledOffset + 3)),
      scheduled_time: index % 4 === 0 ? "09:30:00" : index % 4 === 1 ? "14:00:00" : null,
      estimated_duration: "4 horas",
      checklist: [],
      operational_steps: [],
      progress: ["finalizada", "cerrada"].includes(status) ? 100 : index % 100,
      service_type: "Servicio estándar",
      amount_to_collect: index % 7 === 0 ? 15000 + index * 10 : null,
      work_order_number: `WO-${pad(number, 4)}`,
      completed_at: ["finalizada", "cerrada"].includes(status)
        ? addDays(today, scheduledOffset).toISOString()
        : null,
      closed_at: status === "cerrada" ? addDays(today, scheduledOffset + 1).toISOString() : null,
    }
  }
  )

  for (const batch of chunk(rows, 25)) {
    const { error } = await supabase.from("tasks").insert(batch)
    if (error) {
      throw new Error(`Failed to seed tasks: ${error.message}`)
    }
  }

  const { data, error: loadError } = await supabase
    .from("tasks")
    .select("id, code, title, project_id, project_code, project_name, crew, status")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .like("code", "DEMO-OT-%")

  if (loadError || !data) {
    throw new Error(loadError?.message ?? "Failed to load seeded tasks")
  }

  return data
}

async function seedAvailability(
  supabase: SupabaseAdmin,
  employees: { id: string }[]
) {
  const today = new Date()
  const rows: Database["public"]["Tables"]["employee_availability"]["Insert"][] =
    employees.slice(0, 8).map((employee, index) => ({
      company_id: BESPOKE_DEMO_COMPANY_ID,
      employee_id: employee.id,
      start_date: toDateOnly(addDays(today, index * 3)),
      end_date: toDateOnly(addDays(today, index * 3 + 2)),
      availability_type: index % 2 === 0 ? "VACATION" : "SICK_LEAVE",
      reason: `Demo Seed — ${index % 2 === 0 ? "Licencia" : "Ausencia médica"}`,
    }))

  const { error } = await supabase.from("employee_availability").insert(rows)

  if (error) {
    throw new Error(`Failed to seed availability: ${error.message}`)
  }
}

async function seedAuditLog(
  supabase: SupabaseAdmin,
  projects: { id: string; code: string; name: string }[],
  tasks: { id: string; code: string; title: string }[]
) {
  const modules = ["obras", "tareas", "clientes", "cuadrillas", "rrhh", "reportes"]
  const actions = ["create", "update", "status_change", "view", "export"]
  const today = new Date()

  const rows = Array.from({ length: AUDIT_LOG_COUNT }, (_, index) => {
    const usesTask = index % 2 === 0
    const task = tasks[index % tasks.length]
    const project = projects[index % projects.length]

    return {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      module: modules[index % modules.length],
      action: actions[index % actions.length],
      entity_type: usesTask ? "task" : "project",
      entity_id: usesTask ? task.id : project.id,
      entity_label: usesTask ? task.code : project.code,
      description: usesTask
        ? `Actualización demo en ${task.title}.`
        : `Evento demo en ${project.name}.`,
      severity: index % 11 === 0 ? "WARNING" : "INFO",
      performed_by_name: "Administrador Demo",
      performed_by_role: "demo",
      metadata: { demoSeed: true, sequence: index + 1 },
      created_at: addDays(today, -(index % 30)).toISOString(),
    }
  })

  const { error } = await supabase.from("system_audit_log").insert(rows)

  if (error) {
    throw new Error(`Failed to seed audit log: ${error.message}`)
  }
}

async function seedAutomaticReports(supabase: SupabaseAdmin) {
  const today = new Date()
  const rows = Array.from({ length: REPORT_HISTORY_COUNT }, (_, index) => ({
    report_type: "weekly",
    generated_at: addDays(today, -(index * 7)).toISOString(),
    generated_by: "Demo Seed",
    recipient: "reportes.demo@bespoke.example",
    status: index === 0 ? "sent" : index % 5 === 0 ? "failed" : "generated",
    pdf_storage_path: `automatic-reports/demo/weekly-${index + 1}.pdf`,
    pdf_file_name: `Bespoke-Weekly-Report-Demo-${index + 1}.pdf`,
    week_number: 20 + index,
    execution_time_ms: 1200 + index * 40,
    email_sent_at: index % 5 === 0 ? null : addDays(today, -(index * 7)).toISOString(),
  }))

  const { error } = await supabase.from("automatic_report_history").insert(rows)

  if (error) {
    throw new Error(`Failed to seed automatic report history: ${error.message}`)
  }
}

async function seedEvidences(
  supabase: SupabaseAdmin,
  tasks: {
    id: string
    code: string
    title: string
    project_id: string | null
    project_code: string
    project_name: string
    crew: string
    status: string
  }[]
) {
  const completedTasks = tasks.filter((task) =>
    ["finalizada", "cerrada", "en-aprobacion", "pendiente-cierre"].includes(task.status)
  )

  const rows: Database["public"]["Tables"]["evidences"]["Insert"][] =
    completedTasks.slice(0, 24).map((task, index) => ({
      company_id: BESPOKE_DEMO_COMPANY_ID,
      file_name: `demo-seed-evidence-${pad(index + 1, 2)}.jpg`,
      file_type: "photo",
      evidence_type: "progress-photo",
      storage_bucket: "evidences",
      storage_path: `demo/${task.code}/evidence-${index + 1}.jpg`,
      mime_type: "image/jpeg",
      file_size_bytes: 180_000 + index * 1000,
      project_id: task.project_id,
      project_code: task.project_code,
      project_name: task.project_name,
      task_id: task.id,
      task_code: task.code,
      task_title: task.title,
      crew: task.crew || "Cuadrilla Demo 1",
      worker: "Operario Demo",
      uploaded_at: new Date().toISOString(),
      status: index % 4 === 0 ? "pending-review" : "approved",
      description: "Evidencia demo registrada para demostración comercial.",
      category: "Campo",
      comments: [],
      upload_history: [],
    }))

  const { error } = await supabase.from("evidences").insert(rows)

  if (error) {
    throw new Error(`Failed to seed evidences: ${error.message}`)
  }
}

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log("Resetting demo company data…")
  await resetDemoDataDirect(supabase)

  console.log("Ensuring Bespoke Demo company…")
  await ensureDemoCompany(supabase)

  console.log("Seeding customers…")
  const customers = await seedCustomers(supabase)

  console.log("Seeding employees…")
  const employees = await seedEmployees(supabase)

  console.log("Seeding crews…")
  const crews = await seedCrews(supabase, employees)

  console.log("Seeding projects…")
  const supervisors = employees.filter((employee) => employee.employee_type === "supervisor")
  const projects = await seedProjects(supabase, customers, supervisors)

  console.log("Seeding tasks…")
  const tasks = await seedTasks(supabase, customers, projects, crews)

  console.log("Seeding availability…")
  await seedAvailability(supabase, employees)

  console.log("Seeding audit log…")
  await seedAuditLog(supabase, projects, tasks)

  console.log("Seeding automatic reports…")
  await seedAutomaticReports(supabase)

  console.log("Seeding evidences…")
  await seedEvidences(supabase, tasks)

  console.log("Ensuring demo admin account…")
  const demoAdmin = await ensureDemoAdminAccount(supabase)

  console.log("\nDemo seed completed successfully.")
  console.log(`Company: ${BESPOKE_DEMO_COMPANY_NAME} (${BESPOKE_DEMO_COMPANY_ID})`)
  console.log(
    `Counts → customers: ${CUSTOMER_COUNT}, employees: ${EMPLOYEE_COUNT}, crews: ${CREW_COUNT}, projects: ${PROJECT_COUNT}, tasks: ${TASK_COUNT}`
  )
  console.log(
    `\nDemo login → email: ${DEMO_ADMIN_EMAIL} | password: ${DEMO_ADMIN_PASSWORD}`
  )
  console.log(
    `Demo admin auth user ${demoAdmin.created ? "created" : "reused"} (${demoAdmin.authUserId}).`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
