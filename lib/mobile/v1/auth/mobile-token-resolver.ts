import "server-only"

import { buildSessionUserFromAuthUser } from "@/lib/auth/resolve-session-user"
import { assertEmployeeCanUseMobile } from "@/lib/mobile/v1/auth/assert-employee-mobile-access"
import { createMobileAuthClient } from "@/lib/mobile/v1/auth/create-mobile-auth-client"
import {
  buildMobileAuthContext,
  type MobileAuthContext,
} from "@/lib/mobile/v1/auth/mobile-auth-context"
import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"
import { decodeJwtTiming } from "@/lib/mobile/v1/auth/decode-jwt-exp"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchEmployeeByAppUserId } from "@/lib/supabase/employees.queries"

/**
 * Validates a Supabase access token and resolves the mobile auth context.
 * Token-related failures always surface as 401 without distinguishing cause.
 */
export async function resolveMobileAuthFromAccessToken(
  accessToken: string
): Promise<MobileAuthContext> {
  const authClient = createMobileAuthClient()

  const { data, error } = await authClient.auth.getUser(accessToken)

  if (error || !data.user) {
    console.debug("[Mobile API auth failure]", {
      stage: "supabase_get_user",
      supabaseError: error?.message ?? null,
      jwt: decodeJwtTiming(accessToken),
      serverTime: new Date().toISOString(),
    })

    throw new MobileApiError(
      "UNAUTHORIZED",
      MOBILE_API_ERROR_MESSAGES.UNAUTHORIZED,
      401
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

  const employee = employeeResult.data
  assertEmployeeCanUseMobile(employee)

  const sessionUser = buildSessionUserFromAuthUser(data.user, employee)

  return buildMobileAuthContext(sessionUser, employee)
}
