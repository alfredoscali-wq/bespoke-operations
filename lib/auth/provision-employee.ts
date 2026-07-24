import "server-only"

/**
 * Employee Auth access helpers.
 * Provisioning is centralized in AuthProvisioningService (identity by DNI).
 */

export {
  provisionAuthIdentityForEmployee,
  provisionEmployeeAccess,
  type AuthProvisioningResult,
} from "@/lib/auth/auth-provisioning-service"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchEmployeeById,
  patchEmployee,
} from "@/lib/supabase/employees.queries"

export type DisableEmployeeAccessResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Hard-disables access by deleting the Auth user and clearing app_user_id.
 * Soft-delete flows should use softDeleteEmployeeAccess instead (ban + keep Auth).
 */
export async function disableEmployeeAccess(
  employeeId: string
): Promise<DisableEmployeeAccessResult> {
  const trimmedId = employeeId.trim()

  if (!trimmedId) {
    return {
      success: false,
      error: "employeeId es obligatorio.",
    }
  }

  const admin = createAdminClient()
  const employeeResult = await fetchEmployeeById(admin, trimmedId)

  if (employeeResult.error || !employeeResult.data) {
    return {
      success: false,
      error: employeeResult.error?.message ?? "Empleado no encontrado.",
    }
  }

  const employee = employeeResult.data

  if (!employee.appUserId) {
    return {
      success: false,
      error: "El empleado no tiene un usuario Auth vinculado.",
    }
  }

  const authUserId = employee.appUserId

  const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId)

  if (deleteError) {
    return {
      success: false,
      error: deleteError.message,
    }
  }

  const patchResult = await patchEmployee(admin, trimmedId, {
    appUserId: null,
    mustChangePassword: false,
  })

  if (patchResult.error) {
    return {
      success: false,
      error:
        patchResult.error.message ??
        "El usuario Auth fue eliminado pero no se pudo limpiar app_user_id en RRHH.",
    }
  }

  return { success: true }
}
