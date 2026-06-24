import "server-only"

import { normalizeDni } from "@/lib/auth/auth-identity"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchEmployeeById,
  patchEmployee,
} from "@/lib/supabase/employees.queries"
import type { Employee } from "@/lib/types/employees"

export type ResetEmployeePasswordResult =
  | { success: true }
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

export async function resetEmployeePassword(
  employeeId: string
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

  if (employeeResult.error || !employeeResult.data) {
    return {
      success: false,
      error: employeeResult.error?.message ?? "Empleado no encontrado.",
    }
  }

  const employee = employeeResult.data
  const validationError = validateEmployeeForPasswordReset(employee)

  if (validationError) {
    return validationError
  }

  const normalizedDni = normalizeDni(employee.nationalId!.trim())
  const authUserId = employee.appUserId!

  const { error: authError } = await admin.auth.admin.updateUserById(
    authUserId,
    {
      password: normalizedDni,
    }
  )

  if (authError) {
    return {
      success: false,
      error: authError.message || "No se pudo restablecer la contraseña en Auth.",
    }
  }

  const patchResult = await patchEmployee(admin, trimmedId, {
    mustChangePassword: true,
  })

  if (patchResult.error || !patchResult.data) {
    return {
      success: false,
      error:
        patchResult.error?.message ??
        "La contraseña fue restablecida, pero no se pudo actualizar el estado del empleado en RRHH.",
    }
  }

  return { success: true }
}
