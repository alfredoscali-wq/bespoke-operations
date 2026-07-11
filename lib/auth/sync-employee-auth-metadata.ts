import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { fetchCompanyRoleById } from "@/lib/supabase/company-roles.queries"
import {
  fetchActiveEmployeeIdsByRoleId,
  fetchEmployeeById,
} from "@/lib/supabase/employees.queries"
import {
  buildSessionRoleContext,
  serializeModuleVisibilityForMetadata,
} from "@/lib/roles/session-role"
import { mapRoleCodeToSystemRole } from "@/lib/roles/role-utils"

export async function syncEmployeeAuthMetadata(
  employeeId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = createAdminClient()
  const employeeResult = await fetchEmployeeById(admin, employeeId)

  if (employeeResult.error || !employeeResult.data) {
    return {
      success: false,
      error: employeeResult.error?.message ?? "Empleado no encontrado.",
    }
  }

  const employee = employeeResult.data

  if (!employee.appUserId) {
    return { success: true }
  }

  const roleResult = employee.roleId
    ? await fetchCompanyRoleById(admin, employee.roleId)
    : { data: null, error: null }

  const role = roleResult.data ?? null
  const sessionRole = buildSessionRoleContext({ employee, role })
  const systemRole = role
    ? mapRoleCodeToSystemRole(role.code)
    : employee.systemRole

  const { error } = await admin.auth.admin.updateUserById(employee.appUserId, {
    user_metadata: {
      employee_id: employee.id,
      national_id: employee.nationalId ?? null,
      system_role: systemRole,
      role_id: role?.id ?? employee.roleId ?? null,
      role_code: role?.code ?? null,
      allowed_modules: serializeModuleVisibilityForMetadata(
        sessionRole.moduleVisibility
      ),
    },
  })

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

    const result = await syncEmployeeAuthMetadata(employeeId)

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
