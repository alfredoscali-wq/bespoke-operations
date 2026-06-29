import "server-only"

import type { NextResponse } from "next/server"

import { extractBearerToken } from "@/lib/mobile/v1/auth/extract-bearer-token"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { resolveMobileAuthFromAccessToken } from "@/lib/mobile/v1/auth/mobile-token-resolver"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"
import type { MobileRequestContext } from "@/lib/mobile/v1/request-context"
import type { MobileApiErrorResponse } from "@/lib/mobile/v1/types/responses"

export type MobileAuthenticatedContext = {
  request: MobileRequestContext
  auth: MobileAuthContext
}

export type MobileBearerMiddlewareResult =
  | { ok: true; context: MobileAuthenticatedContext }
  | { ok: false; response: NextResponse<MobileApiErrorResponse> }

export async function mobileBearerMiddleware(
  request: Request,
  requestContext: MobileRequestContext
): Promise<MobileBearerMiddlewareResult> {
  const accessToken = extractBearerToken(request)

  if (!accessToken) {
    return {
      ok: false,
      response: mobileApiErrorResponse(
        requestContext,
        "UNAUTHORIZED",
        MOBILE_API_ERROR_MESSAGES.UNAUTHORIZED,
        401
      ),
    }
  }

  try {
    const auth = await resolveMobileAuthFromAccessToken(accessToken)

    return {
      ok: true,
      context: {
        request: requestContext,
        auth,
      },
    }
  } catch (error) {
    if (error instanceof MobileApiError) {
      return {
        ok: false,
        response: mobileApiErrorResponse(
          requestContext,
          error.code,
          error.message,
          error.status
        ),
      }
    }

    console.error("[Mobile API]", {
      requestId: requestContext.requestId,
      message: "Bearer authentication failed",
    })

    return {
      ok: false,
      response: mobileApiErrorResponse(
        requestContext,
        "UNAUTHORIZED",
        MOBILE_API_ERROR_MESSAGES.UNAUTHORIZED,
        401
      ),
    }
  }
}
