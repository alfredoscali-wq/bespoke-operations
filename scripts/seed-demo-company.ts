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
  DEMO_CORDOBA_ZONES,
  DEMO_CUSTOMERS,
  DEMO_FIELD_TASKS,
} from "@/lib/demo/commercial-dataset"
import { prepareDemoMobileTenant } from "@/lib/demo/prepare-demo-mobile-tenant"
import {
  DEMO_ADMIN_PASSWORD,
  ensureDemoAdminAccount,
} from "@/lib/demo/ensure-demo-admin-account"
import type { Database } from "@/lib/supabase/database.types"

const EMPLOYEE_COUNT = 8
const CREW_COUNT = 3
const PROJECT_COUNT = 2
const AUDIT_LOG_COUNT = 16
const REPORT_HISTORY_COUNT = 4

type SupabaseAdmin = ReturnType<typeof createClient<Database>>

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const webPassword = env.match(/^DEMO_WEB_PASSWORD=(.+)$/m)?.[1]?.trim()
  const mobilePassword = env.match(/^DEMO_MOBILE_PASSWORD=(.+)$/m)?.[1]?.trim()
  if (webPassword) {
    process.env.DEMO_WEB_PASSWORD = webPassword
  }
  if (mobilePassword) {
    process.env.DEMO_MOBILE_PASSWORD = mobilePassword
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
    .like("code", "DEMO-OT-%")

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

  await supabase
    .from("tasks")
    .delete()
    .eq("company_id", companyId)
    .like("code", "DEMO-OT-%")

  await supabase
    .from("tasks")
    .update({ crew_id: null, crew: "" })
    .eq("company_id", companyId)
    .like("code", "DEMO-MOBILE-%")

  const { data: demoCrews } = await supabase
    .from("crews")
    .select("id, name")
    .eq("company_id", companyId)
    .like("name", "Cuadrilla Demo %")

  const demoCrewIds = (demoCrews ?? []).map((crew) => crew.id)

  if (demoCrewIds.length > 0) {
    await supabase.from("crew_members").delete().in("crew_id", demoCrewIds)
  }

  const extraCrewIds = (demoCrews ?? [])
    .filter((crew) => !["Cuadrilla Demo 1", "Cuadrilla Demo 2", "Cuadrilla Demo 3"].includes(crew.name))
    .map((crew) => crew.id)

  if (extraCrewIds.length > 0) {
    await supabase
      .from("crews")
      .update({ status: "inactiva" })
      .eq("company_id", companyId)
      .in("id", extraCrewIds)
  }

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

  await supabase
    .from("work_order_type_checklist_items")
    .delete()
    .eq("company_id", companyId)
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
  const rows = DEMO_CUSTOMERS.map((customer) => ({
    company_id: BESPOKE_DEMO_COMPANY_ID,
    customer_number: customer.externalCode,
    external_customer_code: customer.externalCode,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    locality: customer.locality,
    technology: "fiber",
    status: "activo",
    validation_status: "active",
    latitude: customer.latitude,
    longitude: customer.longitude,
  }))

  const { error } = await supabase.from("customers").insert(rows)
  if (error) {
    throw new Error(`Failed to seed customers: ${error.message}`)
  }

  const { data, error: loadError } = await supabase
    .from("customers")
    .select("id, name, phone, address, locality, external_customer_code, latitude, longitude")
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
      const isSupervisor = number <= 2

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

  const crewBases = [
    {
      name: "Base operativa Córdoba",
      address: "Av. Rafael Núñez 4500, Cerro de las Rosas, Córdoba",
      latitude: DEMO_CORDOBA_ZONES.cerro.latitude,
      longitude: DEMO_CORDOBA_ZONES.cerro.longitude,
    },
    {
      name: "Base Alberdi",
      address: "Av. Colón 1900, Alberdi, Córdoba",
      latitude: DEMO_CORDOBA_ZONES.alberdi.latitude,
      longitude: DEMO_CORDOBA_ZONES.alberdi.longitude,
    },
    {
      name: "Base General Paz",
      address: "Av. 24 de Septiembre 700, General Paz, Córdoba",
      latitude: DEMO_CORDOBA_ZONES.generalPaz.latitude,
      longitude: DEMO_CORDOBA_ZONES.generalPaz.longitude,
    },
  ]

  const crewRows = Array.from({ length: CREW_COUNT }, (_, index) => {
    const supervisor = supervisors[index % supervisors.length]
    const supervisorName = `${supervisor.first_name} ${supervisor.last_name}`
    const base = crewBases[index]

    return {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      name: `Cuadrilla Demo ${index + 1}`,
      description: "Cuadrilla de demostración comercial en Córdoba",
      supervisor: supervisorName,
      supervisor_employee_id: supervisor.id,
      status: "activa" as const,
      notes: DEMO_SEED_MARKER,
      operational_base_name: base.name,
      operational_base_address: base.address,
      operational_base_latitude: base.latitude,
      operational_base_longitude: base.longitude,
    }
  })

  const crews = []
  for (const row of crewRows) {
    const { data: existing, error: existingError } = await supabase
      .from("crews")
      .select("id, name")
      .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
      .eq("name", row.name)
      .maybeSingle()

    if (existingError) {
      throw new Error(`Failed to load ${row.name}: ${existingError.message}`)
    }

    if (existing) {
      const { data, error } = await supabase
        .from("crews")
        .update(row)
        .eq("id", existing.id)
        .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
        .select("id, name, supervisor, supervisor_employee_id")
        .single()
      if (error || !data) {
        throw new Error(error?.message ?? `Failed to update ${row.name}`)
      }
      crews.push(data)
    } else {
      const { data, error } = await supabase
        .from("crews")
        .insert(row as Database["public"]["Tables"]["crews"]["Insert"])
        .select("id, name, supervisor, supervisor_employee_id")
        .single()
      if (error || !data) {
        throw new Error(error?.message ?? `Failed to create ${row.name}`)
      }
      crews.push(data)
    }
  }

  const memberRows = crews.flatMap((crew, crewIndex) => {
    const sliceStart = crewIndex * 2
    const members = operarios.slice(sliceStart, sliceStart + 2)

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
  customers: { name: string; locality: string | null }[],
  supervisors: { first_name: string; last_name: string }[]
) {
  const today = new Date()
  const rows = [
    {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      code: "DEMO-OB-01",
      name: "Tendido FTTH Nueva Córdoba",
      client: customers[0]?.name ?? "Familia Roldán",
      type: "fiber" as const,
      status: "active",
      progress: 35,
      supervisor: `${supervisors[0].first_name} ${supervisors[0].last_name}`,
      location: DEMO_CORDOBA_ZONES.nuevaCordoba.name,
      latitude: DEMO_CORDOBA_ZONES.nuevaCordoba.latitude,
      longitude: DEMO_CORDOBA_ZONES.nuevaCordoba.longitude,
      description: "Obra de demostración: tendido de fibra en Nueva Córdoba.",
      start_date: toDateOnly(addDays(today, -30)),
      end_date: toDateOnly(addDays(today, 60)),
    },
    {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      code: "DEMO-OB-02",
      name: "Mantenimiento red zona norte",
      client: customers[5]?.name ?? "Residencia Villa Belgrano",
      type: "maintenance" as const,
      status: "planned",
      progress: 10,
      supervisor: `${supervisors[1]?.first_name ?? supervisors[0].first_name} ${supervisors[1]?.last_name ?? supervisors[0].last_name}`,
      location: DEMO_CORDOBA_ZONES.cerro.name,
      latitude: DEMO_CORDOBA_ZONES.cerro.latitude,
      longitude: DEMO_CORDOBA_ZONES.cerro.longitude,
      description: "Obra de demostración: mantenimiento de red en zona norte.",
      start_date: toDateOnly(addDays(today, -10)),
      end_date: toDateOnly(addDays(today, 90)),
    },
  ]

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
    external_customer_code: string | null
    latitude?: number | null
    longitude?: number | null
  }[],
  crews: { id: string; name: string }[]
) {
  const today = new Date()
  const rows: Database["public"]["Tables"]["tasks"]["Insert"][] = DEMO_FIELD_TASKS.map(
    (definition) => {
      const customer = customers.find(
        (item) => item.external_customer_code === definition.customerCode
      )
      const crew = definition.crewName
        ? crews.find((item) => item.name === definition.crewName)
        : null
      const finished = definition.status === "finalizada"

      return {
        company_id: BESPOKE_DEMO_COMPANY_ID,
        code: definition.code,
        title: definition.title,
        description: definition.description,
        project_id: null,
        project_code: "OT",
        project_name: "Orden de trabajo",
        customer_id: customer?.id ?? null,
        customer_name: customer?.name ?? "Cliente Demo Córdoba",
        customer_phone: customer?.phone ?? null,
        service_address: customer?.address ?? null,
        locality: customer?.locality ?? null,
        latitude: customer?.latitude ?? null,
        longitude: customer?.longitude ?? null,
        type: definition.type,
        status: "programada",
        priority: definition.role === "overdue" ? "alta" : "media",
        supervisor: "Ana Acosta",
        crew_id: crew?.id ?? null,
        crew: crew?.name ?? "",
        start_date: toDateOnly(addDays(today, definition.startOffsetDays)),
        due_date: toDateOnly(addDays(today, definition.dueOffsetDays)),
        scheduled_time: definition.scheduledTime,
        estimated_duration: "2 horas",
        checklist: [],
        operational_steps: [],
        progress: finished ? 100 : definition.status === "en-curso" ? 45 : 0,
        service_type: definition.serviceType,
        work_order_number: definition.code,
        completed_at: finished ? addDays(today, definition.dueOffsetDays).toISOString() : null,
        closed_at: null,
        task_metadata: {
          demoSeed: DEMO_SEED_MARKER,
          technology: "fiber",
        },
      }
    }
  )

  const { error } = await supabase.from("tasks").insert(rows)
  if (error) {
    throw new Error(`Failed to seed tasks: ${error.message}`)
  }

  const statusPath: Record<string, string[]> = {
    programada: [],
    asignada: ["asignada"],
    vencida: ["vencida"],
    "en-curso": ["asignada", "en-curso"],
    "pendiente-cierre": ["asignada", "en-curso", "pendiente-cierre"],
    finalizada: ["asignada", "en-curso", "pendiente-cierre", "finalizada"],
  }

  for (const definition of DEMO_FIELD_TASKS) {
    const path = statusPath[definition.status] ?? []
    for (const status of path) {
      const { error: statusError } = await supabase
        .from("tasks")
        .update({
          status: status as Database["public"]["Tables"]["tasks"]["Update"]["status"],
          progress: definition.status === "finalizada" ? 100 : definition.status === "en-curso" ? 45 : 0,
          completed_at:
            status === "finalizada"
              ? addDays(today, definition.dueOffsetDays).toISOString()
              : null,
        })
        .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
        .eq("code", definition.code)

      if (statusError) {
        throw new Error(
          `Failed to transition ${definition.code} to ${status}: ${statusError.message}`
        )
      }
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
    employees.slice(0, 2).map((employee, index) => ({
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
  const tasks = await seedTasks(supabase, customers, crews)

  console.log("Seeding availability…")
  await seedAvailability(supabase, employees)

  console.log("Seeding audit log…")
  await seedAuditLog(supabase, projects, tasks)

  console.log("Seeding automatic reports…")
  await seedAutomaticReports(supabase)

  console.log("Ensuring demo admin account…")
  const demoAdmin = await ensureDemoAdminAccount(supabase)

  console.log("Preparing Demo Mobile overlay…")
  await prepareDemoMobileTenant(supabase)

  console.log("\nDemo seed completed successfully.")
  console.log(`Company: ${BESPOKE_DEMO_COMPANY_NAME} (${BESPOKE_DEMO_COMPANY_ID})`)
  console.log(
    `Counts → customers: ${DEMO_CUSTOMERS.length}, employees: ${EMPLOYEE_COUNT}, crews: ${CREW_COUNT}, projects: ${PROJECT_COUNT}, field OTs: ${DEMO_FIELD_TASKS.length}`
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
