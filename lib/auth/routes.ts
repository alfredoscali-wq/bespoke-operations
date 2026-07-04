import type { SystemRole } from "@/lib/types/employees"
import { isMobileApiPublicPath } from "@/lib/mobile/v1/routing"

export const LOGIN_PATH = "/login"
export const AUTH_CALLBACK_PATH = "/auth/callback"
export const CHANGE_PASSWORD_PATH = "/cambiar-contrasena"
export const PROFILE_PATH = "/perfil"

export function isChangePasswordPath(pathname: string): boolean {
  return (
    pathname === CHANGE_PASSWORD_PATH ||
    pathname.startsWith(`${CHANGE_PASSWORD_PATH}/`)
  )
}

export function isPasswordChangeGuardAllowedPath(pathname: string): boolean {
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return true
  }

  if (
    pathname === AUTH_CALLBACK_PATH ||
    pathname.startsWith(`${AUTH_CALLBACK_PATH}/`)
  ) {
    return true
  }

  return isChangePasswordPath(pathname)
}

export function isAuthPublicPath(pathname: string): boolean {
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return true
  }

  if (
    pathname === AUTH_CALLBACK_PATH ||
    pathname.startsWith(`${AUTH_CALLBACK_PATH}/`)
  ) {
    return true
  }

  if (pathname.startsWith("/api/health")) {
    return true
  }

  if (pathname.startsWith("/api/cron/")) {
    return true
  }

  if (isMobileApiPublicPath(pathname)) {
    return true
  }

  return false
}

export function isOperarioPortalPath(pathname: string): boolean {
  return pathname === "/operario" || pathname.startsWith("/operario/")
}

export function isDashboardPath(pathname: string): boolean {
  if (isAuthPublicPath(pathname)) return false
  if (isOperarioPortalPath(pathname)) return false
  if (isChangePasswordPath(pathname)) return false
  if (pathname.startsWith("/api/")) return false
  return true
}

export function isDemoRestrictedAdminPath(pathname: string): boolean {
  if (pathname === "/configuracion" || pathname.startsWith("/configuracion/")) {
    return true
  }

  if (pathname === "/usuarios" || pathname.startsWith("/usuarios/")) {
    return true
  }

  if (pathname === "/mantenimiento" || pathname.startsWith("/mantenimiento/")) {
    return true
  }

  if (
    pathname === "/clientes/migracion" ||
    pathname.startsWith("/clientes/migracion/")
  ) {
    return true
  }

  return false
}

export function isPlanificacionOperativaPath(pathname: string): boolean {
  return (
    pathname === "/operations/planificacion" ||
    pathname.startsWith("/operations/planificacion/")
  )
}

export function canAccessPlanificacionOperativa(
  systemRole: SystemRole | null | undefined
): boolean {
  return systemRole === "administrador" || systemRole === "supervisor"
}

export function getDefaultPostLoginPath(
  systemRole: SystemRole | null | undefined
): string {
  if (systemRole === "operario") return "/operario"
  if (systemRole === "demo") return "/"
  return "/"
}

export function sanitizeRedirectPath(
  next: string | null | undefined,
  fallback = "/"
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback
  }

  if (next.startsWith(LOGIN_PATH)) {
    return fallback
  }

  return next
}
