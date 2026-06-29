import type { NextResponse } from "next/server"

import type { MobileAuthenticatedContext } from "@/lib/mobile/v1/auth/mobile-bearer-middleware"
import { requireAuthenticatedMobileUser } from "@/lib/mobile/v1/auth/mobile-auth-helpers"
import { handleMobileApiError } from "@/lib/mobile/v1/error-factory"
import {
  createMobileRequestContext,
  type MobileRequestContext,
} from "@/lib/mobile/v1/request-context"

export async function handlePublicMobileRoute(
  request: Request,
  handler: (context: MobileRequestContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const context = createMobileRequestContext(request)

  try {
    return await handler(context)
  } catch (error) {
    return handleMobileApiError(context, error)
  }
}

export async function handleProtectedMobileRoute(
  request: Request,
  handler: (context: MobileAuthenticatedContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await requireAuthenticatedMobileUser(request)

  if (!authResult.ok) {
    return authResult.response
  }

  try {
    return await handler(authResult.context)
  } catch (error) {
    return handleMobileApiError(authResult.context.request, error)
  }
}
