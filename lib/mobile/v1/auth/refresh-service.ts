import "server-only"

import { assertEmployeeCanUseMobile } from "@/lib/mobile/v1/auth/assert-employee-mobile-access"
import { createMobileAuthClient } from "@/lib/mobile/v1/auth/create-mobile-auth-client"
import type { MobileRefreshTokenRequest } from "@/lib/mobile/v1/auth/contracts"
import type { MobileRefreshTokenResponse } from "@/lib/mobile/v1/auth/contracts"
import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchEmployeeByAppUserId } from "@/lib/supabase/employees.queries"

function isRefreshTokenInvalidMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("invalid refresh token") ||
    normalized.includes("refresh token not found") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("token has expired") ||
    normalized.includes("session not found")
  )
}

export async function refreshMobileSession(
  request: MobileRefreshTokenRequest
): Promise<MobileRefreshTokenResponse> {
  const authClient = createMobileAuthClient()

  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: request.refreshToken,
  })

  if (error || !data.session || !data.user) {
    const message = error?.message ?? ""

    if (message && isRefreshTokenInvalidMessage(message)) {
      throw new MobileApiError(
        "SESSION_EXPIRED",
        MOBILE_API_ERROR_MESSAGES.SESSION_EXPIRED,
        401
      )
    }

    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  const admin = createAdminClient()
  const employeeResult = await fetchEmployeeByAppUserId(admin, data.user.id)

  if (!employeeResult.data) {
    throw new MobileApiError(
      "EMPLOYEE_NOT_FOUND",
      MOBILE_API_ERROR_MESSAGES.EMPLOYEE_NOT_FOUND,
      404
    )
  }

  assertEmployeeCanUseMobile(employeeResult.data)

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in ?? 3600,
  }
}
