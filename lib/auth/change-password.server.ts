import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { patchEmployee } from "@/lib/supabase/employees.queries"

export { parseWebChangePasswordRequest } from "@/lib/auth/validate-web-change-password-request"
export { WEB_CHANGE_PASSWORD_MIN_LENGTH } from "@/lib/auth/validate-web-change-password-request"

export const EMPLOYEE_SYNC_ERROR_MESSAGE =
  "La contraseña fue actualizada correctamente, pero no se pudo sincronizar el estado del empleado. Contacte al administrador."

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; phase: "auth"; message: string }
  | { ok: false; phase: "employee"; message: string }
  | { ok: false; phase: "validation"; message: string }

function resolveAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message).toLowerCase()

    if (message.includes("same password")) {
      return "La nueva contraseña debe ser distinta a la actual."
    }

    if (message.includes("weak password") || message.includes("password")) {
      return "La contraseña no cumple los requisitos de seguridad."
    }
  }

  return "No se pudo actualizar la contraseña. Intente nuevamente."
}

/**
 * Changes the signed-in user's Auth password (user JWT), then clears
 * employees.must_change_password on the session employee via service_role.
 * Does not accept a client-supplied employeeId.
 */
export async function changeOwnPassword(input: {
  employeeId: string
  newPassword: string
}): Promise<ChangePasswordResult> {
  const employeeId = input.employeeId.trim()
  if (!employeeId) {
    return {
      ok: false,
      phase: "employee",
      message: EMPLOYEE_SYNC_ERROR_MESSAGE,
    }
  }

  const supabase = await createClient()
  const { error: authError } = await supabase.auth.updateUser({
    password: input.newPassword,
  })

  if (authError) {
    return {
      ok: false,
      phase: "auth",
      message: resolveAuthErrorMessage(authError),
    }
  }

  const admin = createAdminClient()
  const employeeResult = await patchEmployee(admin, employeeId, {
    mustChangePassword: false,
  })

  if (employeeResult.error || !employeeResult.data) {
    return {
      ok: false,
      phase: "employee",
      message: EMPLOYEE_SYNC_ERROR_MESSAGE,
    }
  }

  return { ok: true }
}
