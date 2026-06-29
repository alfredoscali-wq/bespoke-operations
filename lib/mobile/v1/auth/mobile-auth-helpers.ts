import "server-only"

import type { NextResponse } from "next/server"

import {
  mobileBearerMiddleware,
  type MobileAuthenticatedContext,
} from "@/lib/mobile/v1/auth/mobile-bearer-middleware"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { createMobileRequestContext } from "@/lib/mobile/v1/request-context"
import type { MobileApiErrorResponse } from "@/lib/mobile/v1/types/responses"

export type { MobileAuthenticatedContext } from "@/lib/mobile/v1/auth/mobile-bearer-middleware"
export type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"

export type RequireAuthenticatedMobileUserResult =
  | { ok: true; context: MobileAuthenticatedContext }
  | { ok: false; response: NextResponse<MobileApiErrorResponse> }

export async function requireAuthenticatedMobileUser(
  request: Request
): Promise<RequireAuthenticatedMobileUserResult> {
  const requestContext = createMobileRequestContext(request)
  return mobileBearerMiddleware(request, requestContext)
}

export function getAuthenticatedMobileUser(
  context: MobileAuthenticatedContext
): MobileAuthContext {
  return context.auth
}

export function requireAuthenticatedUser(
  context: MobileAuthenticatedContext
): MobileAuthContext {
  return context.auth
}

export function requireCompany(auth: MobileAuthContext): string {
  if (!auth.companyId.trim()) {
    throw new MobileApiError(
      "EMPLOYEE_NOT_FOUND",
      "Empresa no disponible para el usuario autenticado.",
      404
    )
  }

  return auth.companyId
}

export function requireEmployee(auth: MobileAuthContext): string {
  if (!auth.employeeId.trim()) {
    throw new MobileApiError(
      "EMPLOYEE_NOT_FOUND",
      "Empleado inexistente",
      404
    )
  }

  return auth.employeeId
}
