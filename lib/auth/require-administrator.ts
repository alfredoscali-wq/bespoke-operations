import "server-only"

import { getSessionUser, type SessionUser } from "@/lib/auth/session"

export type AdministratorSessionResult =
  | { ok: true; sessionUser: SessionUser }
  | { ok: false; status: 401 | 403; message: string }

export async function requireAdministratorSession(): Promise<AdministratorSessionResult> {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return {
      ok: false,
      status: 401,
      message: "Debe iniciar sesión para realizar esta acción.",
    }
  }

  if (sessionUser.systemRole !== "administrador") {
    return {
      ok: false,
      status: 403,
      message: "Solo un administrador puede realizar esta acción.",
    }
  }

  return { ok: true, sessionUser }
}
