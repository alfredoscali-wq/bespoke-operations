import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

import {
  BESPOKE_DEMO_COMPANY_ID,
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_EMPLOYEE_CODE,
  DEMO_SEED_MARKER,
} from "@/lib/demo/constants"
import type { Database } from "@/lib/supabase/database.types"

/** Contraseña inicial del administrador demo (solo entorno de demostración). */
export const DEMO_ADMIN_PASSWORD = "Demo2026!"

type SupabaseAdmin = SupabaseClient<Database>

type DemoAdminEmployeeRow = {
  id: string
  app_user_id: string | null
}

async function findAuthUserByEmail(
  supabase: SupabaseAdmin,
  email: string
): Promise<User | null> {
  const normalized = email.toLowerCase()

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`)
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalized
    )

    if (match) {
      return match
    }

    if (data.users.length < 200) {
      break
    }
  }

  return null
}

async function findDemoAdminEmployee(
  supabase: SupabaseAdmin
): Promise<DemoAdminEmployeeRow | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, app_user_id")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("employee_code", DEMO_ADMIN_EMPLOYEE_CODE)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load demo admin employee: ${error.message}`)
  }

  return data
}

async function upsertDemoAdminEmployee(
  supabase: SupabaseAdmin,
  appUserId?: string | null
): Promise<DemoAdminEmployeeRow> {
  const existing = await findDemoAdminEmployee(supabase)

  const employeeFields = {
    company_id: BESPOKE_DEMO_COMPANY_ID,
    employee_code: DEMO_ADMIN_EMPLOYEE_CODE,
    first_name: "Administrador",
    last_name: "Demo",
    job_title: "Administrador Demo",
    department: "Demostración",
    employee_type: "administrativo" as const,
    employment_status: "active" as const,
    email: DEMO_ADMIN_EMAIL,
    system_role: "demo" as const,
    system_access: true,
    must_change_password: false,
    notes: `${DEMO_SEED_MARKER} demo platform admin account`,
    ...(appUserId ? { app_user_id: appUserId } : {}),
  }

  if (existing) {
    const { data, error } = await supabase
      .from("employees")
      .update(employeeFields)
      .eq("id", existing.id)
      .select("id, app_user_id")
      .single()

    if (error || !data) {
      throw new Error(
        error?.message ?? "Failed to update demo admin employee record."
      )
    }

    return data
  }

  const { data, error } = await supabase
    .from("employees")
    .insert(employeeFields)
    .select("id, app_user_id")
    .single()

  if (error || !data) {
    throw new Error(
      error?.message ?? "Failed to create demo admin employee record."
    )
  }

  return data
}

async function linkEmployeeToAuthUser(
  supabase: SupabaseAdmin,
  employeeId: string,
  authUserId: string
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .update({
      app_user_id: authUserId,
      system_access: true,
      system_role: "demo",
      employment_status: "active",
      must_change_password: false,
    })
    .eq("id", employeeId)
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)

  if (error) {
    throw new Error(`Failed to link demo admin employee: ${error.message}`)
  }
}

async function syncAuthUserMetadata(
  supabase: SupabaseAdmin,
  authUserId: string,
  employeeId: string
): Promise<void> {
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    user_metadata: {
      employee_id: employeeId,
      system_role: "demo",
      full_name: "Administrador Demo",
    },
  })

  if (error) {
    throw new Error(`Failed to sync demo admin auth metadata: ${error.message}`)
  }
}

/**
 * Garantiza cuenta Auth + empleado demo vinculados para el tenant Bespoke Demo.
 * Idempotente: no duplica usuarios; repara vínculos si hace falta.
 */
export async function ensureDemoAdminAccount(
  supabase: SupabaseAdmin
): Promise<{ employeeId: string; authUserId: string; created: boolean }> {
  let authUser = await findAuthUserByEmail(supabase, DEMO_ADMIN_EMAIL)
  let created = false

  if (!authUser) {
    const employee = await upsertDemoAdminEmployee(supabase)

    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        employee_id: employee.id,
        system_role: "demo",
        full_name: "Administrador Demo",
      },
    })

    if (error || !data.user) {
      throw new Error(
        error?.message ?? "Failed to create demo admin auth user."
      )
    }

    authUser = data.user
    created = true
    await linkEmployeeToAuthUser(supabase, employee.id, authUser.id)

    return { employeeId: employee.id, authUserId: authUser.id, created }
  }

  const employee = await upsertDemoAdminEmployee(supabase, authUser.id)

  if (employee.app_user_id !== authUser.id) {
    await linkEmployeeToAuthUser(supabase, employee.id, authUser.id)
  }

  await syncAuthUserMetadata(supabase, authUser.id, employee.id)

  return { employeeId: employee.id, authUserId: authUser.id, created }
}
