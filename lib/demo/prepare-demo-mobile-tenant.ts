import type { SupabaseClient } from "@supabase/supabase-js"

import { decideDemoMobileDeviceCrewBinding } from "@/lib/demo/bind-demo-mobile-device"
import {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_DEMO_COMPANY_NAME,
  DEMO_MOBILE_BASE_GPS,
  DEMO_MOBILE_COMPANY_CODE,
  DEMO_MOBILE_CREW_NAME,
  DEMO_MOBILE_DEVICE_ID,
  DEMO_SEED_MARKER,
} from "@/lib/demo/constants"
import { DEMO_MOBILE_TASK_DEFINITIONS } from "@/lib/demo/demo-mobile-checklists"
import { ensureDemoOperarioAccount } from "@/lib/demo/ensure-demo-operario-account"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type { Database, Json } from "@/lib/supabase/database.types"
import { OPERATIONAL_CHECKLIST_TEMPLATE_KEY } from "@/lib/tasks/operational-checklist-template"
import { OPERATIONAL_CHECKLIST_RESPONSES_KEY } from "@/lib/tasks/operational-checklist-responses"

type SupabaseAdmin = SupabaseClient<Database>

export type PrepareDemoMobileTenantResult = {
  companyId: string
  mobileCode: string
  operarioEmployeeId: string
  operarioAuthUserId: string
  crewId: string
  deviceId: string
  deviceRecordId: string
  taskCodes: string[]
}

async function assertDemoCompany(supabase: SupabaseAdmin) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, mobile_code")
    .eq("id", BESPOKE_DEMO_COMPANY_ID)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load Demo company: ${error.message}`)
  }

  if (!data) {
    throw new Error("Bespoke Demo company was not found.")
  }

  if (data.id === BESPOKE_PRODUCTION_COMPANY_ID) {
    throw new Error("Refusing to mutate the production tenant.")
  }
}

async function assignUniqueDemoMobileCode(supabase: SupabaseAdmin) {
  const { data: conflict, error: conflictError } = await supabase
    .from("companies")
    .select("id, mobile_code, name")
    .eq("mobile_code", DEMO_MOBILE_COMPANY_CODE)
    .maybeSingle()

  if (conflictError) {
    throw new Error(`Failed to check mobile_code uniqueness: ${conflictError.message}`)
  }

  if (conflict && conflict.id !== BESPOKE_DEMO_COMPANY_ID) {
    throw new Error(
      `mobile_code ${DEMO_MOBILE_COMPANY_CODE} already belongs to ${conflict.name} (${conflict.id}).`
    )
  }

  const { data: production, error: productionError } = await supabase
    .from("companies")
    .select("id, mobile_code")
    .eq("id", BESPOKE_PRODUCTION_COMPANY_ID)
    .maybeSingle()

  if (productionError) {
    throw new Error(`Failed to verify ABNet mobile_code: ${productionError.message}`)
  }

  const productionCode = production?.mobile_code ?? null

  const { error } = await supabase
    .from("companies")
    .update({
      mobile_code: DEMO_MOBILE_COMPANY_CODE,
      display_name: BESPOKE_DEMO_COMPANY_NAME,
    })
    .eq("id", BESPOKE_DEMO_COMPANY_ID)
    .is("deleted_at", null)

  if (error) {
    throw new Error(`Failed to set Demo mobile_code: ${error.message}`)
  }

  const { data: productionAfter, error: afterError } = await supabase
    .from("companies")
    .select("mobile_code")
    .eq("id", BESPOKE_PRODUCTION_COMPANY_ID)
    .maybeSingle()

  if (afterError) {
    throw new Error(`Failed to re-check ABNet mobile_code: ${afterError.message}`)
  }

  if ((productionAfter?.mobile_code ?? null) !== productionCode) {
    throw new Error("ABNet mobile_code changed unexpectedly. Aborting.")
  }
}

async function upsertDemoMobileSettings(supabase: SupabaseAdmin) {
  const { error } = await supabase.from("company_mobile_settings").upsert(
    {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      shift_location_validation_enabled: false,
      shift_radius_meters: 150,
      task_location_validation_enabled: false,
      task_radius_meters: 150,
      gps_heartbeat_enabled: true,
      gps_heartbeat_interval_seconds: 60,
    },
    { onConflict: "company_id" }
  )

  if (error) {
    throw new Error(`Failed to upsert Demo mobile settings: ${error.message}`)
  }
}

async function prepareDemoCrew(
  supabase: SupabaseAdmin,
  employee: { id: string; firstName: string; lastName: string }
) {
  const { data: crew, error } = await supabase
    .from("crews")
    .select("id, company_id, name, status")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("name", DEMO_MOBILE_CREW_NAME)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load ${DEMO_MOBILE_CREW_NAME}: ${error.message}`)
  }

  if (!crew) {
    throw new Error(`${DEMO_MOBILE_CREW_NAME} was not found in Bespoke Demo.`)
  }

  if (crew.company_id !== BESPOKE_DEMO_COMPANY_ID) {
    throw new Error("Demo crew is not scoped to Bespoke Demo.")
  }

  const { error: updateError } = await supabase
    .from("crews")
    .update({
      status: "activa",
      operational_base_name: DEMO_MOBILE_BASE_GPS.name,
      operational_base_address: DEMO_MOBILE_BASE_GPS.address,
      operational_base_latitude: DEMO_MOBILE_BASE_GPS.latitude,
      operational_base_longitude: DEMO_MOBILE_BASE_GPS.longitude,
    })
    .eq("id", crew.id)
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)

  if (updateError) {
    throw new Error(`Failed to update Demo crew: ${updateError.message}`)
  }

  const { data: membership, error: membershipError } = await supabase
    .from("crew_members")
    .select("id, active")
    .eq("crew_id", crew.id)
    .eq("employee_id", employee.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (membershipError) {
    throw new Error(`Failed to load crew membership: ${membershipError.message}`)
  }

  if (!membership) {
    const { error: insertMemberError } = await supabase.from("crew_members").insert({
      crew_id: crew.id,
      employee_id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      role: "Operario",
      active: true,
    })

    if (insertMemberError) {
      throw new Error(
        `Failed to add Operario Demo to crew: ${insertMemberError.message}`
      )
    }
  } else if (!membership.active) {
    const { error: activateError } = await supabase
      .from("crew_members")
      .update({ active: true })
      .eq("id", membership.id)
      .eq("crew_id", crew.id)

    if (activateError) {
      throw new Error(`Failed to activate crew membership: ${activateError.message}`)
    }
  }

  return crew.id
}

async function prepareDemoDevice(supabase: SupabaseAdmin, crewId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("mobile_devices")
    .select("id, company_id, work_team_id, status")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("device_id", DEMO_MOBILE_DEVICE_ID)
    .is("deleted_at", null)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load Demo device: ${existingError.message}`)
  }

  if (!existing) {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("mobile_devices")
      .insert({
        company_id: BESPOKE_DEMO_COMPANY_ID,
        work_team_id: crewId,
        device_id: DEMO_MOBILE_DEVICE_ID,
        manufacturer: "Bespoke",
        model: "Demo Field Agent",
        android_version: "14",
        app_version: "demo",
        platform: "android",
        status: "ACTIVE",
        registered_at: now,
        last_seen_at: now,
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create Demo mobile device.")
    }

    return data.id
  }

  if (existing.company_id !== BESPOKE_DEMO_COMPANY_ID) {
    throw new Error("Demo device is not scoped to Bespoke Demo.")
  }

  const { data: crew, error: crewError } = await supabase
    .from("crews")
    .select("id, company_id")
    .eq("id", crewId)
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .is("deleted_at", null)
    .maybeSingle()

  if (crewError || !crew) {
    throw new Error(crewError?.message ?? "Demo crew is not scoped to Bespoke Demo.")
  }

  const decision = decideDemoMobileDeviceCrewBinding({
    authCompanyId: BESPOKE_DEMO_COMPANY_ID,
    deviceWorkTeamId: existing.work_team_id,
    employeeCrews: [
      {
        id: crewId,
        companyId: BESPOKE_DEMO_COMPANY_ID,
        name: DEMO_MOBILE_CREW_NAME,
      },
    ],
  })

  if (decision.action === "bind" || existing.status !== "ACTIVE") {
    const { error } = await supabase
      .from("mobile_devices")
      .update({
        work_team_id: crewId,
        status: "ACTIVE",
      })
      .eq("id", existing.id)
      .eq("company_id", BESPOKE_DEMO_COMPANY_ID)

    if (error) {
      throw new Error(`Failed to bind Demo device: ${error.message}`)
    }
  }

  return existing.id
}

async function prepareDemoMobileTasks(supabase: SupabaseAdmin, crewId: string) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, code, name, client, supervisor")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("code", "DEMO-OB-01")
    .is("deleted_at", null)
    .maybeSingle()

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "DEMO-OB-01 was not found.")
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, phone, address, locality")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("name", project.client)
    .is("deleted_at", null)
    .maybeSingle()

  if (customerError) {
    throw new Error(`Failed to load Demo customer: ${customerError.message}`)
  }

  const today = toLocalDateOnly()
  const taskCodes: string[] = []

  for (const definition of DEMO_MOBILE_TASK_DEFINITIONS) {
    const metadata = {
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: [...definition.checklist],
      [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: {},
      demoMobile: true,
      demoSeed: DEMO_SEED_MARKER,
    } as unknown as Json

    const { data: existing, error: existingError } = await supabase
      .from("tasks")
      .select("id")
      .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
      .eq("code", definition.code)
      .is("deleted_at", null)
      .maybeSingle()

    if (existingError) {
      throw new Error(`Failed to load ${definition.code}: ${existingError.message}`)
    }

    const payload = {
      company_id: BESPOKE_DEMO_COMPANY_ID,
      code: definition.code,
      title: definition.title,
      description: definition.description,
      project_id: project.id,
      project_code: project.code,
      project_name: project.name,
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? project.client,
      customer_phone: customer?.phone ?? null,
      service_address: definition.serviceAddress,
      locality: customer?.locality ?? "Ciudad Norte",
      latitude: definition.latitude,
      longitude: definition.longitude,
      type: "maintenance" as const,
      status: "asignada" as const,
      priority: "media" as const,
      supervisor: project.supervisor,
      crew_id: crewId,
      crew: DEMO_MOBILE_CREW_NAME,
      start_date: today,
      due_date: today,
      scheduled_time: "09:00:00",
      estimated_duration: "2 horas",
      checklist: [],
      operational_steps: [],
      progress: 0,
      service_type: "obra-task",
      work_order_number: definition.code,
      completed_at: null,
      closed_at: null,
      task_metadata: metadata,
    }

    if (existing) {
      const { error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", existing.id)
        .eq("company_id", BESPOKE_DEMO_COMPANY_ID)

      if (error) {
        throw new Error(`Failed to update ${definition.code}: ${error.message}`)
      }
    } else {
      const { error } = await supabase.from("tasks").insert(payload)

      if (error) {
        throw new Error(`Failed to create ${definition.code}: ${error.message}`)
      }
    }

    const { data: current, error: currentError } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
      .eq("code", definition.code)
      .is("deleted_at", null)
      .maybeSingle()

    if (currentError || !current) {
      throw new Error(
        currentError?.message ?? `Failed to reload ${definition.code}.`
      )
    }

    if (current.status === "programada") {
      const { error: dispatchError } = await supabase
        .from("tasks")
        .update({
          status: "asignada",
          crew_id: crewId,
          crew: DEMO_MOBILE_CREW_NAME,
        })
        .eq("id", current.id)
        .eq("company_id", BESPOKE_DEMO_COMPANY_ID)

      if (dispatchError) {
        throw new Error(
          `Failed to dispatch ${definition.code}: ${dispatchError.message}`
        )
      }
    }

    taskCodes.push(definition.code)
  }

  return taskCodes
}

export async function prepareDemoMobileTenant(
  supabase: SupabaseAdmin
): Promise<PrepareDemoMobileTenantResult> {
  await assertDemoCompany(supabase)
  await assignUniqueDemoMobileCode(supabase)
  await upsertDemoMobileSettings(supabase)

  const operario = await ensureDemoOperarioAccount(supabase)
  const crewId = await prepareDemoCrew(supabase, {
    id: operario.employeeId,
    firstName: "Operario",
    lastName: "Demo",
  })
  const deviceRecordId = await prepareDemoDevice(supabase, crewId)
  const taskCodes = await prepareDemoMobileTasks(supabase, crewId)

  return {
    companyId: BESPOKE_DEMO_COMPANY_ID,
    mobileCode: DEMO_MOBILE_COMPANY_CODE,
    operarioEmployeeId: operario.employeeId,
    operarioAuthUserId: operario.authUserId,
    crewId,
    deviceId: DEMO_MOBILE_DEVICE_ID,
    deviceRecordId,
    taskCodes,
  }
}
