import "server-only"

import type { User } from "@supabase/supabase-js"

import { resolveSignInEmailCandidates } from "@/lib/auth/auth-identity"
import { buildSessionUserFromAuthUser } from "@/lib/auth/resolve-session-user"
import { assertEmployeeCanUseMobile } from "@/lib/mobile/v1/auth/assert-employee-mobile-access"
import { createMobileAuthClient } from "@/lib/mobile/v1/auth/create-mobile-auth-client"
import { mapMobileLoginUser } from "@/lib/mobile/v1/auth/map-mobile-user-response"
import type { MobileLoginRequest, MobileLoginResponse } from "@/lib/mobile/v1/auth/types"
import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchEmployeeByAppUserId } from "@/lib/supabase/employees.queries"
import type { SessionUser } from "@/lib/auth/types"

export type MobileLoginServiceResult = MobileLoginResponse & {
  sessionUser: SessionUser
}

function isInvalidCredentialsError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  )
}

export async function authenticateMobileLogin(
  request: MobileLoginRequest
): Promise<MobileLoginServiceResult> {
  const authClient = createMobileAuthClient()
  const emailCandidates = resolveSignInEmailCandidates(request.email)

  let session: {
    access_token: string
    refresh_token: string
    expires_in?: number
  } | null = null
  let authUser: User | null = null
  let lastAuthMessage = ""

  for (const candidateEmail of emailCandidates) {
    const { data, error } = await authClient.auth.signInWithPassword({
      email: candidateEmail,
      password: request.password,
    })

    if (!error && data.session && data.user) {
      session = data.session
      authUser = data.user
      break
    }

    lastAuthMessage = error?.message ?? ""
  }

  if (!session || !authUser) {
    if (lastAuthMessage && !isInvalidCredentialsError(lastAuthMessage)) {
      throw new MobileApiError(
        "INTERNAL_ERROR",
        MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
        500
      )
    }

    throw new MobileApiError(
      "INVALID_CREDENTIALS",
      MOBILE_API_ERROR_MESSAGES.INVALID_CREDENTIALS,
      401
    )
  }

  const admin = createAdminClient()
  const employeeResult = await fetchEmployeeByAppUserId(admin, authUser.id)

  if (!employeeResult.data) {
    throw new MobileApiError(
      "EMPLOYEE_NOT_FOUND",
      MOBILE_API_ERROR_MESSAGES.EMPLOYEE_NOT_FOUND,
      404
    )
  }

  const employee = employeeResult.data
  assertEmployeeCanUseMobile(employee)

  const sessionUser = buildSessionUserFromAuthUser(authUser, employee)

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in ?? 3600,
    user: mapMobileLoginUser(sessionUser, employee),
    sessionUser,
  }
}
