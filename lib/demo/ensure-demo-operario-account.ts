import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

import {
  BESPOKE_DEMO_COMPANY_ID,
  DEMO_OPERARIO_EMAIL,
  DEMO_OPERARIO_EMPLOYEE_CODE,
  DEMO_SEED_MARKER,
} from "@/lib/demo/constants"
import { DEMO_ADMIN_PASSWORD } from "@/lib/demo/ensure-demo-admin-account"
import type { Database } from "@/lib/supabase/database.types"

type SupabaseAdmin = SupabaseClient<Database>

type DemoOperarioEmployeeRow = {
  id: string
  app_user_id: string | null
}

export function resolveDemoOperarioPassword(): string {
  return (
    process.env.DEMO_MOBILE_PASSWORD?.trim() ||
    process.env.DEMO_OPERARIO_PASSWORD?.trim() ||
    DEMO_ADMIN_PASSWORD
  )
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

async function findDemoOperarioEmployee(
  supabase: SupabaseAdmin
): Promise<DemoOperarioEmployeeRow | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, app_user_id")
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
    .eq("employee_code", DEMO_OPERARIO_EMPLOYEE_CODE)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load demo operario employee: ${error.message}`)
  }

  return data
}

async function upsertDemoOperarioEmployee(
  supabase: SupabaseAdmin,
  appUserId?: string | null
): Promise<DemoOperarioEmployeeRow> {
  const existing = await findDemoOperarioEmployee(supabase)

  const employeeFields = {
    company_id: BESPOKE_DEMO_COMPANY_ID,
    employee_code: DEMO_OPERARIO_EMPLOYEE_CODE,
    first_name: "Operario",
    last_name: "Demo",
    job_title: "Operario de campo",
    department: "Operaciones",
    employee_type: "operario" as const,
    employment_status: "active" as const,
    email: DEMO_OPERARIO_EMAIL,
    system_role: "operario" as const,
    system_access: true,
    must_change_password: false,
    notes: `${DEMO_SEED_MARKER} demo mobile field operator`,
    ...(appUserId ? { app_user_id: appUserId } : {}),
  }

  if (existing) {
    const { data, error } = await supabase
      .from("employees")
      .update(employeeFields)
      .eq("id", existing.id)
      .eq("company_id", BESPOKE_DEMO_COMPANY_ID)
      .select("id, app_user_id")
      .single()

    if (error || !data) {
      throw new Error(
        error?.message ?? "Failed to update demo operario employee record."
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
      error?.message ?? "Failed to create demo operario employee record."
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
      system_role: "operario",
      employment_status: "active",
      must_change_password: false,
    })
    .eq("id", employeeId)
    .eq("company_id", BESPOKE_DEMO_COMPANY_ID)

  if (error) {
    throw new Error(`Failed to link demo operario employee: ${error.message}`)
  }
}

async function syncAuthUserMetadata(
  supabase: SupabaseAdmin,
  authUserId: string,
  employeeId: string
): Promise<void> {
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password: resolveDemoOperarioPassword(),
    email_confirm: true,
    user_metadata: {
      employee_id: employeeId,
      system_role: "operario",
      full_name: "Operario Demo",
    },
  })

  if (error) {
    throw new Error(
      `Failed to sync demo operario auth metadata: ${error.message}`
    )
  }
}

/**
 * Auth + employee for Bespoke Mobile demo. Tenant Demo only. Idempotent.
 */
export async function ensureDemoOperarioAccount(
  supabase: SupabaseAdmin
): Promise<{ employeeId: string; authUserId: string; created: boolean }> {
  let authUser = await findAuthUserByEmail(supabase, DEMO_OPERARIO_EMAIL)
  let created = false
  const password = resolveDemoOperarioPassword()

  if (!authUser) {
    const employee = await upsertDemoOperarioEmployee(supabase)

    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_OPERARIO_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        employee_id: employee.id,
        system_role: "operario",
        full_name: "Operario Demo",
      },
    })

    if (error || !data.user) {
      throw new Error(
        error?.message ?? "Failed to create demo operario auth user."
      )
    }

    authUser = data.user
    created = true
    await linkEmployeeToAuthUser(supabase, employee.id, authUser.id)

    return { employeeId: employee.id, authUserId: authUser.id, created }
  }

  const employee = await upsertDemoOperarioEmployee(supabase, authUser.id)

  if (employee.app_user_id !== authUser.id) {
    await linkEmployeeToAuthUser(supabase, employee.id, authUser.id)
  }

  await syncAuthUserMetadata(supabase, authUser.id, employee.id)

  return { employeeId: employee.id, authUserId: authUser.id, created }
}
