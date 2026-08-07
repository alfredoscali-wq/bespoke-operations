import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { fetchCompanyRoleById } from "@/lib/supabase/company-roles.queries"
import {
  fetchActiveEmployeeIdsByRoleId,
  fetchEmployeeById,
} from "@/lib/supabase/employees.queries"
import {
  addAuthSyncTimer,
  getAuthSyncStore,
  recordAuthSyncCall,
  recordAuthSyncQuery,
} from "@/lib/auth/performance/auth-sync-profiler"
import { nowMs } from "@/lib/auth/performance/enabled"
import {
  buildSessionRoleContext,
  serializeModuleVisibilityForMetadata,
} from "@/lib/roles/session-role"
import { mapRoleCodeToSystemRole } from "@/lib/roles/role-utils"
import type { CompanyRole } from "@/lib/types/company-roles"
import type { Employee } from "@/lib/types/employees"

/**
 * Sprint 30.0 — reusable employee+role payload for metadata sync.
 * When provided, skips redundant employees / company_roles lookups.
 */
export type AuthSyncContext = {
  userId: string
  employee: Employee
  role: CompanyRole | null
}

function resolveEmployeeDisplayName(employee: Employee): string {
  const preferred = employee.preferredName?.trim()
  if (preferred) return preferred
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.id
}

function isAuthSyncContext(
  input: string | AuthSyncContext
): input is AuthSyncContext {
  return typeof input !== "string"
}

async function resolveEmployeeAndRole(
  input: string | AuthSyncContext
): Promise<
  | { ok: true; employee: Employee; role: CompanyRole | null }
  | { ok: false; error: string }
> {
  if (isAuthSyncContext(input)) {
    return { ok: true, employee: input.employee, role: input.role }
  }

  const authSync = getAuthSyncStore()
  const admin = createAdminClient()
  const employeeId = input

  recordAuthSyncCall("employee lookup")
  const employeeStarted = nowMs()
  const employeeResult = await fetchEmployeeById(admin, employeeId)
  const employeeDuration = nowMs() - employeeStarted
  if (authSync) {
    addAuthSyncTimer("employeeMs", employeeDuration)
    recordAuthSyncQuery("employees", employeeDuration)
  }

  if (employeeResult.error || !employeeResult.data) {
    return {
      ok: false,
      error: employeeResult.error?.message ?? "Empleado no encontrado.",
    }
  }

  const employee = employeeResult.data

  recordAuthSyncCall("role lookup")
  const roleStarted = nowMs()
  const roleResult = employee.roleId
    ? await fetchCompanyRoleById(admin, employee.roleId)
    : { data: null, error: null }
  const roleDuration = nowMs() - roleStarted
  if (authSync) {
    addAuthSyncTimer("roleMs", roleDuration)
    if (employee.roleId) {
      recordAuthSyncQuery("company_roles", roleDuration)
    }
  }

  return { ok: true, employee, role: roleResult.data ?? null }
}

/**
 * Sync Auth user_metadata from employee + role.
 * Pass AuthSyncContext to reuse rows already loaded by getSessionUser (Sprint 30.0).
 * Pass employeeId string when the caller has not loaded those rows yet.
 */
export async function syncEmployeeAuthMetadata(
  input: string | AuthSyncContext
): Promise<{ success: true } | { success: false; error: string }> {
  const authSync = getAuthSyncStore()
  const resolved = await resolveEmployeeAndRole(input)

  if (!resolved.ok) {
    return { success: false, error: resolved.error }
  }

  const { employee, role } = resolved
  const appUserId =
    isAuthSyncContext(input) ? input.userId : employee.appUserId

  if (!appUserId) {
    return { success: true }
  }

  const sessionRole = buildSessionRoleContext({ employee, role })
  const systemRole = role
    ? mapRoleCodeToSystemRole(role.code)
    : employee.systemRole

  const admin = createAdminClient()
  const metadataStarted = nowMs()
  const { error } = await admin.auth.admin.updateUserById(appUserId, {
    user_metadata: {
      display_name: resolveEmployeeDisplayName(employee),
      company_id: employee.companyId,
      role: systemRole,
      system_role: systemRole,
      allowed_modules: serializeModuleVisibilityForMetadata(
        sessionRole.moduleVisibility
      ),
      must_change_password: employee.mustChangePassword,
      employee_id: employee.id,
      contractor_id: employee.contractorId ?? null,
      national_id: employee.nationalId ?? null,
      role_id: role?.id ?? employee.roleId ?? null,
      role_code: role?.code ?? null,
    },
  })
  const metadataDuration = nowMs() - metadataStarted
  if (authSync) {
    addAuthSyncTimer("metadataUpdateMs", metadataDuration)
    recordAuthSyncQuery("auth.updateUserById", metadataDuration)
  }

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export type SyncEmployeesByRoleResult =
  | {
      success: true
      syncedCount: number
      skippedWithoutAppUser: number
    }
  | {
      success: false
      error: string
      failedEmployeeId?: string
    }

export async function syncEmployeesAuthMetadataByRoleId(input: {
  roleId: string
  companyId: string
}): Promise<SyncEmployeesByRoleResult> {
  const admin = createAdminClient()
  const roleResult = await fetchCompanyRoleById(admin, input.roleId)

  if (roleResult.error || !roleResult.data) {
    return {
      success: false,
      error: roleResult.error?.message ?? "Área no encontrada.",
    }
  }

  if (roleResult.data.companyId !== input.companyId) {
    return {
      success: false,
      error: "El área no pertenece a la empresa indicada.",
    }
  }

  const employeesResult = await fetchActiveEmployeeIdsByRoleId(
    admin,
    input.roleId,
    input.companyId
  )

  if (employeesResult.error || !employeesResult.data) {
    return {
      success: false,
      error:
        employeesResult.error?.message ??
        "No fue posible listar empleados del área.",
    }
  }

  let syncedCount = 0
  let skippedWithoutAppUser = 0
  const role = roleResult.data

  for (const employeeId of employeesResult.data) {
    const employeeResult = await fetchEmployeeById(admin, employeeId)

    if (employeeResult.error || !employeeResult.data) {
      return {
        success: false,
        error:
          employeeResult.error?.message ??
          "No fue posible obtener un empleado del área.",
        failedEmployeeId: employeeId,
      }
    }

    if (!employeeResult.data.appUserId) {
      skippedWithoutAppUser += 1
      continue
    }

    const result = await syncEmployeeAuthMetadata({
      userId: employeeResult.data.appUserId,
      employee: employeeResult.data,
      role,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        failedEmployeeId: employeeId,
      }
    }

    syncedCount += 1
  }

  return { success: true, syncedCount, skippedWithoutAppUser }
}
