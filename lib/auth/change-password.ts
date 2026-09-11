export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; phase: "auth" | "employee" | "validation"; message: string }

/**
 * Client helper for the change-password form.
 * Posts only newPassword; the server binds the employee from the session.
 */
export async function changePassword(params: {
  newPassword: string
}): Promise<ChangePasswordResult> {
  let response: Response

  try {
    response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: params.newPassword }),
    })
  } catch {
    return {
      ok: false,
      phase: "auth",
      message: "No se pudo actualizar la contraseña. Intente nuevamente.",
    }
  }

  let payload: {
    success?: boolean
    phase?: string
    error?: string
    message?: string
  } = {}

  try {
    payload = (await response.json()) as typeof payload
  } catch {
    payload = {}
  }

  if (!response.ok || payload.success === false) {
    const phase =
      payload.phase === "employee" ||
      payload.phase === "validation" ||
      payload.phase === "auth"
        ? payload.phase
        : response.status >= 500
          ? "employee"
          : "auth"

    return {
      ok: false,
      phase,
      message:
        payload.error?.trim() ||
        payload.message?.trim() ||
        "No se pudo actualizar la contraseña. Intente nuevamente.",
    }
  }

  return { ok: true }
}
