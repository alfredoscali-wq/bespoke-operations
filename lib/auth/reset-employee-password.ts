import "server-only"

import {
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR,
  resolveAdminEmployeeTenantAccess,
} from "@/lib/auth/admin-employee-tenant"
import { normalizeDni } from "@/lib/auth/auth-identity"
import { resolveAuthUserById } from "@/lib/auth/auth-user-lookup"
import { generateTemporaryPassword } from "@/lib/auth/temporary-password"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchEmployeeById,
  patchEmployee,
} from "@/lib/supabase/employees.queries"
import type { Employee } from "@/lib/types/employees"

const AUTH_NOT_FOUND_ERROR =
  "El empleado no tiene un usuario Auth válido."
const AUTH_LOOKUP_ERROR =
  "No se pudo verificar el usuario Auth. Intente nuevamente."
const AUTH_UPDATE_ERROR = "No se pudo restablecer la contraseña en Auth."
const EMPLOYEE_PATCH_ERROR =
  "La contraseña fue restablecida, pero no se pudo actualizar el estado del empleado en RRHH."

export type ResetEmployeePasswordResult =
  | { success: true; temporaryPassword: string }
  | { success: false; error: string }

function validateEmployeeForPasswordReset(
  employee: Employee
): ResetEmployeePasswordResult | null {
  if (!employee.appUserId) {
    return {
      success: false,
      error: "El empleado no tiene un usuario Auth vinculado (app_user_id).",
    }
  }

  const nationalId = employee.nationalId?.trim()
  if (!nationalId || !normalizeDni(nationalId)) {
    return {
      success: false,
      error:
        "El empleado no tiene DNI registrado. No se puede restablecer la contraseña.",
    }
  }

  return null
}

/**
 * Restablece la contraseña a un temporal CSPRNG y marca must_change_password.
 * El secreto se devuelve una sola vez; nunca se persiste ni se loguea.
 */
export async function resetEmployeePassword(
  employeeId: string,
  sessionCompanyId: string
): Promise<ResetEmployeePasswordResult> {
  const trimmedId = employeeId.trim()

  if (!trimmedId) {
    return {
      success: false,
      error: "employeeId es obligatorio.",
    }
  }

  const admin = createAdminClient()
  const employeeResult = await fetchEmployeeById(admin, trimmedId)
  const tenantAccess = resolveAdminEmployeeTenantAccess({
    sessionCompanyId,
    employeeCompanyId: employeeResult.data?.companyId,
    employeeFound: Boolean(employeeResult.data) && !employeeResult.error,
  })
  if (!tenantAccess.ok || !employeeResult.data) {
    return { success: false, error: ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR }
  }

  const employee = employeeResult.data
  const validationError = validateEmployeeForPasswordReset(employee)

  if (validationError) {
    return validationError
  }

  const authUserId = employee.appUserId!
  const authUser = await resolveAuthUserById(admin, authUserId)
  if (!authUser.ok) {
    return {
      success: false,
      error:
        authUser.reason === "lookup_error"
          ? AUTH_LOOKUP_ERROR
          : AUTH_NOT_FOUND_ERROR,
    }
  }

  const temporaryPassword = generateTemporaryPassword()

  const { error: authError } = await admin.auth.admin.updateUserById(
    authUserId,
    {
      password: temporaryPassword,
    }
  )

  if (authError) {
    return {
      success: false,
      error: AUTH_UPDATE_ERROR,
    }
  }

  const patchResult = await patchEmployee(admin, trimmedId, {
    mustChangePassword: true,
  })

  if (patchResult.error || !patchResult.data) {
    return {
      success: false,
      error: EMPLOYEE_PATCH_ERROR,
    }
  }

  const { syncEmployeeAuthMetadata } = await import(
    "@/lib/auth/sync-employee-auth-metadata"
  )
  await syncEmployeeAuthMetadata(trimmedId, sessionCompanyId)

  return { success: true, temporaryPassword }
}
