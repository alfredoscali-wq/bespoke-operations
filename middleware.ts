import { type NextRequest, NextResponse } from "next/server"

import { getMetadataSystemRole } from "@/lib/auth/system-role"
import {
  getDefaultPostLoginPath,
  canAccessPlanificacionOperativa,
  isAuthPublicPath,
  isDashboardPath,
  isDemoRestrictedAdminPath,
  isOperarioPortalPath,
  isPlanificacionOperativaPath,
  LOGIN_PATH,
  sanitizeRedirectPath,
} from "@/lib/auth/routes"
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const supabase = createMiddlewareSupabaseClient(request, response)

  if (!supabase) {
    if (isAuthPublicPath(pathname)) {
      return response
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = LOGIN_PATH
    loginUrl.searchParams.set("error", "supabase_not_configured")
    return NextResponse.redirect(loginUrl)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic = isAuthPublicPath(pathname)

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = LOGIN_PATH
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === LOGIN_PATH) {
    const systemRole = getMetadataSystemRole(user.user_metadata)
    const destination = request.nextUrl.searchParams.get("next")
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = sanitizeRedirectPath(
      destination,
      getDefaultPostLoginPath(systemRole)
    )
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (user) {
    const systemRole = getMetadataSystemRole(user.user_metadata)

    if (
      systemRole === "operario" &&
      isDashboardPath(pathname)
    ) {
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
      redirectUrl.pathname = "/"
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
      !canAccessPlanificacionOperativa(systemRole)
    ) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = getDefaultPostLoginPath(systemRole)
      redirectUrl.search = ""
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
