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
import { startPerformanceTrace } from "@/lib/performance"
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
  const perf = startPerformanceTrace("MOBILE LOGIN", { layer: "backend" })
  try {
    const authClient = createMobileAuthClient()
    const emailCandidates = resolveSignInEmailCandidates(request.email)

    const authAttempt = await perf.span("Auth signIn", async () => {
      let nextSession: {
        access_token: string
        refresh_token: string
        expires_in?: number
      } | null = null
      let nextUser: User | null = null
      let nextMessage = ""

      for (const candidateEmail of emailCandidates) {
        const { data, error } = await authClient.auth.signInWithPassword({
          email: candidateEmail,
          password: request.password,
        })

        if (!error && data.session && data.user) {
          nextSession = data.session
          nextUser = data.user
          break
        }

        nextMessage = error?.message ?? ""
      }

      return {
        session: nextSession,
        authUser: nextUser,
        lastAuthMessage: nextMessage,
      }
    })

    const session = authAttempt.session
    const authUser = authAttempt.authUser
    const lastAuthMessage = authAttempt.lastAuthMessage

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
    const employeeResult = await perf.span("Fetch employee", () =>
      fetchEmployeeByAppUserId(admin, authUser.id)
    )

    if (!employeeResult.data) {
      throw new MobileApiError(
        "EMPLOYEE_NOT_FOUND",
        MOBILE_API_ERROR_MESSAGES.EMPLOYEE_NOT_FOUND,
        404
      )
    }

    const employee = employeeResult.data
    perf.spanSync("Assert mobile access", () =>
      assertEmployeeCanUseMobile(employee)
    )

    const sessionUser = buildSessionUserFromAuthUser(authUser, employee)

    const result = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in ?? 3600,
      user: mapMobileLoginUser(sessionUser, employee),
      sessionUser,
    }
    perf.finish()
    return result
  } catch (error) {
    perf.fail(error)
    throw error
  }
}
