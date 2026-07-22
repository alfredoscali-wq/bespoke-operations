import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchEmployeeById,
  patchEmployee,
  softDeleteEmployee,
} from "@/lib/supabase/employees.queries"

/** ~100 years — keeps Auth row for audit while blocking all sign-in. */
const AUTH_DEACTIVATION_BAN_DURATION = "876600h"

export type SoftDeleteEmployeeAccessResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Soft-deletes an employee and deactivates their Auth access.
 * Preserves the employees row (deleted_at) and operational history.
 * Does not physically delete Auth or employee records.
 */
export async function softDeleteEmployeeAccess(
  employeeId: string
): Promise<SoftDeleteEmployeeAccessResult> {
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

  const accessPatch = await patchEmployee(admin, trimmedId, {
    systemAccess: false,
    mustChangePassword: false,
  })

  if (accessPatch.error) {
    return {
      success: false,
      error:
        accessPatch.error.message ??
        "No se pudo desactivar el acceso del empleado.",
    }
  }

  if (employee.appUserId) {
    const { error: banError } = await admin.auth.admin.updateUserById(
      employee.appUserId,
      { ban_duration: AUTH_DEACTIVATION_BAN_DURATION }
    )

    if (banError) {
      return {
        success: false,
        error:
          banError.message ||
          "No se pudo desactivar el usuario Auth. La eliminación se canceló.",
      }
    }
  }

  const softDeleteResult = await softDeleteEmployee(admin, trimmedId)

  if (softDeleteResult.error) {
    return {
      success: false,
      error:
        softDeleteResult.error.message ??
        "No se pudo marcar el empleado como eliminado.",
    }
  }

  return { success: true }
}
