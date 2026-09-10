import "server-only"

import { isDemoPlatformReadOnlyUser } from "@/lib/demo/demo-mode"
import { DEMO_RESTRICTED_DIALOG_MESSAGE } from "@/lib/demo/constants"
import { denyIfPasswordChangeRequired } from "@/lib/auth/require-password-compliant-session"
import { getSessionUser, type SessionUser } from "@/lib/auth/session"

export type WritablePlatformSessionResult =
  | { ok: true; sessionUser: SessionUser }
  | { ok: false; status: 401 | 403; message: string; code?: string }

export async function requireWritablePlatformSession(): Promise<WritablePlatformSessionResult> {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return {
      ok: false,
      status: 401,
      message: "Debe iniciar sesión para realizar esta acción.",
    }
  }

  const passwordDenial = denyIfPasswordChangeRequired(sessionUser)
  if (passwordDenial) {
    return {
      ok: false,
      status: passwordDenial.status,
      message: passwordDenial.message,
      code: passwordDenial.code,
    }
  }

  if (isDemoPlatformReadOnlyUser(sessionUser)) {
    return {
      ok: false,
      status: 403,
      message: DEMO_RESTRICTED_DIALOG_MESSAGE,
    }
  }

  return { ok: true, sessionUser }
}
