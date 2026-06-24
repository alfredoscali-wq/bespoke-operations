import { createClient } from "@/lib/supabase/client"
import { updateEmployee } from "@/lib/supabase/employees.browser"

const EMPLOYEE_SYNC_ERROR_MESSAGE =
  "La contraseña fue actualizada correctamente, pero no se pudo sincronizar el estado del empleado. Contacte al administrador."

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; phase: "auth"; message: string }
  | { ok: false; phase: "employee"; message: string }

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

export async function changePassword(params: {
  newPassword: string
  employeeId: string | null
}): Promise<ChangePasswordResult> {
  const supabase = createClient()

  const { error: authError } = await supabase.auth.updateUser({
    password: params.newPassword,
  })

  if (authError) {
    return {
      ok: false,
      phase: "auth",
      message: resolveAuthErrorMessage(authError),
    }
  }

  if (!params.employeeId) {
    return {
      ok: false,
      phase: "employee",
      message: EMPLOYEE_SYNC_ERROR_MESSAGE,
    }
  }

  const employeeResult = await updateEmployee(params.employeeId, {
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
