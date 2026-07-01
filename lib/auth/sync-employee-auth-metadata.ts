import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { fetchCompanyRoleById } from "@/lib/supabase/company-roles.queries"
import { fetchEmployeeById } from "@/lib/supabase/employees.queries"
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
