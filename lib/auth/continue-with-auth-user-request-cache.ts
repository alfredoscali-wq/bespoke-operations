/**
 * Sprint 33.0 — attach validated auth user onto the downstream request.
 * Edge-safe (used from middleware).
 */

import { type NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import {
  BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER,
  encodeAuthUserRequestCacheValue,
} from "@/lib/auth/auth-user-request-cache"

/**
 * Strip any client-supplied cache header, then set the middleware-validated value.
 * Preserves cookies already written onto `response` (session refresh).
 */
export function continueWithAuthUserRequestCache(
  request: NextRequest,
  response: NextResponse,
  user: User | null
): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER)
  requestHeaders.set(
    BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER,
    encodeAuthUserRequestCacheValue(user)
  )

  const next = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  for (const cookie of response.cookies.getAll()) {
    next.cookies.set(cookie)
  }

  return next
}
