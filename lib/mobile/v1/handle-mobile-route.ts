import type { NextResponse } from "next/server"

import type { MobileAuthenticatedContext } from "@/lib/mobile/v1/auth/mobile-bearer-middleware"
import { requireAuthenticatedMobileUser } from "@/lib/mobile/v1/auth/mobile-auth-helpers"
import { handleMobileApiError } from "@/lib/mobile/v1/error-factory"
import { startPerformanceTrace } from "@/lib/performance"
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
  const requestContext = createMobileRequestContext(request)
  const perf = startPerformanceTrace("MOBILE AUTH GATE", {
    layer: "backend",
    requestId: requestContext.requestId,
  })

  const authResult = await perf.span("Auth", () =>
    requireAuthenticatedMobileUser(request)
  )

  if (!authResult.ok) {
    perf.finish({ Note: "unauthorized" })
    return authResult.response
  }

  try {
    const response = await perf.span("Handler", () =>
      handler(authResult.context)
    )
    perf.finish()
    return response
  } catch (error) {
    perf.fail(error)
    return handleMobileApiError(authResult.context.request, error)
  }
}
