import "server-only"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { assertSupabaseEnv } from "@/lib/supabase/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { patchEmployee } from "@/lib/supabase/employees.queries"

const EMPLOYEE_SYNC_ERROR_MESSAGE =
  "La contraseña fue actualizada correctamente, pero no se pudo sincronizar el estado del empleado. Contacte al administrador."

function resolveAuthPasswordErrorMessage(errorBody: unknown): string {
  const message =
    errorBody && typeof errorBody === "object" && "msg" in errorBody
      ? String(errorBody.msg)
      : errorBody && typeof errorBody === "object" && "error_description" in errorBody
        ? String(errorBody.error_description)
        : errorBody && typeof errorBody === "object" && "message" in errorBody
          ? String(errorBody.message)
          : ""

  const normalized = message.toLowerCase()

  if (normalized.includes("same password")) {
    return "La nueva contraseña debe ser distinta a la actual."
  }

  if (normalized.includes("weak password") || normalized.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad."
  }

  return "No se pudo actualizar la contraseña. Intente nuevamente."
}

/**
 * Updates the password of the authenticated Auth user using their access token.
 * Does not use service_role and does not accept a target user id.
 */
async function updateAuthenticatedUserPassword(
  accessToken: string,
  newPassword: string
): Promise<void> {
  const { url, anonKey } = assertSupabaseEnv()
  const endpoint = `${url.replace(/\/$/, "")}/auth/v1/user`

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  })

  if (!response.ok) {
    let parsed: unknown = null
    try {
      parsed = await response.json()
    } catch {
      parsed = null
    }

    throw new MobileApiError(
      "INVALID_REQUEST",
      resolveAuthPasswordErrorMessage(parsed),
      response.status >= 500 ? 500 : 400
    )
  }
}

export async function changeMobilePassword(input: {
  accessToken: string
  auth: MobileAuthContext
  newPassword: string
}): Promise<{ ok: true }> {
  await updateAuthenticatedUserPassword(input.accessToken, input.newPassword)

  const admin = createAdminClient()
  const employeeResult = await patchEmployee(admin, input.auth.employeeId, {
    mustChangePassword: false,
  })

  if (employeeResult.error || !employeeResult.data) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      EMPLOYEE_SYNC_ERROR_MESSAGE,
      500
    )
  }

  return { ok: true }
}

export { EMPLOYEE_SYNC_ERROR_MESSAGE as MOBILE_PASSWORD_EMPLOYEE_SYNC_ERROR }
