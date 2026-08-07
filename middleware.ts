import { type NextRequest, NextResponse } from "next/server"

import { continueWithAuthUserRequestCache } from "@/lib/auth/continue-with-auth-user-request-cache"
import {
  resolveAccessDeniedRedirectPath,
  resolvePostLoginPathFromAuthMetadata,
} from "@/lib/auth/module-access"
import {
  beginProxyPerfSession,
  finishProxyPerfSession,
  measureProxySync,
  recordProxyCall,
  recordProxyQuery,
  setProxyTimer,
} from "@/lib/auth/performance/proxy-profiler"
import { nowMs } from "@/lib/auth/performance/enabled"
import { getMetadataSystemRole } from "@/lib/auth/system-role"
import {
  canAccessPlanificacionOperativa,
  isAuthPublicPath,
  isDashboardPath,
  isDemoRestrictedAdminPath,
  isOperarioPortalPath,
  isPlanificacionOperativaPath,
  LOGIN_PATH,
  sanitizeRedirectPath,
} from "@/lib/auth/routes"
import { isMobileApiPath } from "@/lib/mobile/v1/routing"
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const perf = beginProxyPerfSession(request.method, pathname)

  try {
    if (isMobileApiPath(pathname)) {
      return NextResponse.next()
    }

    const response = NextResponse.next({ request })

    const supabase = measureProxySync(perf, "createClientMs", () =>
      createMiddlewareSupabaseClient(request, response)
    )

    if (!supabase) {
      if (isAuthPublicPath(pathname)) {
        return response
      }

      return measureProxySync(perf, "redirectLogicMs", () => {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = LOGIN_PATH
        loginUrl.searchParams.set("error", "supabase_not_configured")
        return NextResponse.redirect(loginUrl)
      })
    }

    // getUser() validates the JWT with Supabase Auth (network).
    // Counted as Get User + JWT Validation (same call — no separate step today).
    // Sprint 33.0 — result is forwarded to handlers via request-cache header.
    recordProxyCall(perf, "getUser()")
    const started = nowMs()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const duration = nowMs() - started
    setProxyTimer(perf, "getUserMs", duration)
    setProxyTimer(perf, "jwtValidationMs", duration)
    recordProxyQuery(perf, "auth.getUser", duration)

    // Metadata is already on the JWT user object — pure CPU parse.
    const systemRole = user
      ? measureProxySync(perf, "loadMetadataMs", () =>
          getMetadataSystemRole(user.user_metadata)
        )
      : null

    // Load Employee / Load Permissions / Get Session are NOT executed in
    // middleware today — timers remain "—" intentionally for the audit.

    const isPublic = isAuthPublicPath(pathname)

    if (!user && !isPublic) {
      return measureProxySync(perf, "redirectLogicMs", () => {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = LOGIN_PATH
        loginUrl.searchParams.set("next", pathname)
        return NextResponse.redirect(loginUrl)
      })
    }

    if (user && pathname === LOGIN_PATH) {
      return measureProxySync(perf, "redirectLogicMs", () => {
        const destination = request.nextUrl.searchParams.get("next")
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = sanitizeRedirectPath(
          destination,
          resolvePostLoginPathFromAuthMetadata(
            systemRole,
            user.user_metadata
          )
        )
        redirectUrl.search = ""
        return NextResponse.redirect(redirectUrl)
      })
    }

    if (user) {
      const redirectResponse = measureProxySync(
        perf,
        "redirectLogicMs",
        () =>
          resolveAuthenticatedRedirect(
            request,
            pathname,
            systemRole,
            user
          )
      )
      if (redirectResponse) {
        return redirectResponse
      }
    }

    return continueWithAuthUserRequestCache(request, response, user)
  } finally {
    finishProxyPerfSession(perf)
  }
}

function resolveAuthenticatedRedirect(
  request: NextRequest,
  pathname: string,
  systemRole: ReturnType<typeof getMetadataSystemRole>,
  user: { user_metadata?: Record<string, unknown> | null }
): NextResponse | null {
  if (systemRole === "operario" && isDashboardPath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/operario"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (
    systemRole &&
    systemRole !== "operario" &&
    isOperarioPortalPath(pathname)
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = resolvePostLoginPathFromAuthMetadata(
      systemRole,
      user.user_metadata
    )
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (systemRole === "demo" && isDemoRestrictedAdminPath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (
    isPlanificacionOperativaPath(pathname) &&
    !canAccessPlanificacionOperativa(systemRole, user.user_metadata)
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = resolveAccessDeniedRedirectPath(
      systemRole,
      user.user_metadata,
      pathname
    )
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  return null
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
