/**
 * Sprint 33.0 / 41.0 — attach validated auth user onto the downstream request.
 * Used from proxy (Next.js 16; formerly middleware).
 */

import { type NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import {
  BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER,
  BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER_LEGACY,
  encodeAuthUserRequestCacheValue,
} from "@/lib/auth/auth-user-request-cache"

function buildForwardedRequestHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers)

  // Never trust client-supplied cache headers.
  requestHeaders.delete(BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER)
  requestHeaders.delete(BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER_LEGACY)

  // Session refresh in proxy mutates request.cookies — sync into Cookie header
  // so handlers see the refreshed tokens on this same request.
  const cookies = request.cookies.getAll()
  if (cookies.length > 0) {
    requestHeaders.set(
      "cookie",
      cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
    )
  }

  return requestHeaders
}

/**
 * Strip forgeable auth-cache headers when proxy skips auth (e.g. mobile API).
 */
export function nextWithoutAuthUserRequestCache(
  request: NextRequest
): NextResponse {
  const requestHeaders = buildForwardedRequestHeaders(request)
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

/**
 * Strip any client-supplied cache header, then set the proxy-validated value.
 * Preserves cookies already written onto `response` (session refresh).
 */
export async function continueWithAuthUserRequestCache(
  request: NextRequest,
  response: NextResponse,
  user: User | null
): Promise<NextResponse> {
  const requestHeaders = buildForwardedRequestHeaders(request)
  requestHeaders.set(
    BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER,
    await encodeAuthUserRequestCacheValue(user)
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
