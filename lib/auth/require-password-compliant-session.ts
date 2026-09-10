import "server-only"

import { NextResponse } from "next/server"

import type { SessionUser } from "@/lib/auth/types"

export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED" as const
export const PASSWORD_CHANGE_REQUIRED_STATUS = 403 as const
export const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  "Debe cambiar su contraseña antes de continuar."

export type PasswordChangeRequiredDenial = {
  ok: false
  status: typeof PASSWORD_CHANGE_REQUIRED_STATUS
  code: typeof PASSWORD_CHANGE_REQUIRED_CODE
  message: string
}

/**
 * Blocks web APIs when employees.must_change_password is true.
 * Uses sessionUser.mustChangePassword from the employee row.
 * Does not treat JWT metadata as authority.
 * Does not treat a missing session as PASSWORD_CHANGE_REQUIRED.
 */
export function denyIfPasswordChangeRequired(
  sessionUser: Pick<SessionUser, "mustChangePassword">
): PasswordChangeRequiredDenial | null {
  if (!sessionUser.mustChangePassword) {
    return null
  }

  return {
    ok: false,
    status: PASSWORD_CHANGE_REQUIRED_STATUS,
    code: PASSWORD_CHANGE_REQUIRED_CODE,
    message: PASSWORD_CHANGE_REQUIRED_MESSAGE,
  }
}

export function passwordChangeRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code: PASSWORD_CHANGE_REQUIRED_CODE,
      error: PASSWORD_CHANGE_REQUIRED_MESSAGE,
      message: PASSWORD_CHANGE_REQUIRED_MESSAGE,
    },
    { status: PASSWORD_CHANGE_REQUIRED_STATUS }
  )
}

export function jsonFromSessionAuthFailure(auth: {
  status: number
  message: string
  code?: string
}): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message: auth.message,
      error: auth.message,
      ...(auth.code ? { code: auth.code } : {}),
    },
    { status: auth.status }
  )
}

export function requireLoadedPasswordCompliantSession(
  sessionUser: SessionUser | null,
  unauthenticatedMessage = "Debe iniciar sesión."
):
  | { ok: true; sessionUser: SessionUser }
  | { ok: false; response: NextResponse } {
  if (!sessionUser) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: unauthenticatedMessage,
          error: unauthenticatedMessage,
        },
        { status: 401 }
      ),
    }
  }

  const denial = denyIfPasswordChangeRequired(sessionUser)
  if (denial) {
    return { ok: false, response: passwordChangeRequiredResponse() }
  }

  return { ok: true, sessionUser }
}
