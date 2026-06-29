import { NextResponse } from "next/server"

import { MOBILE_API_VERSION } from "@/lib/mobile/v1/constants"
import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
  type MobileApiErrorCode,
} from "@/lib/mobile/v1/errors"
import type { MobileRequestContext } from "@/lib/mobile/v1/request-context"
import { getMobileApiServerTimeForResponse } from "@/lib/mobile/v1/request-context"
import type { MobileApiErrorResponse } from "@/lib/mobile/v1/types/responses"

function buildMobileResponseHeaders(requestId: string): HeadersInit {
  return {
    "X-Request-Id": requestId,
  }
}

export function mobileApiErrorResponse(
  context: Pick<MobileRequestContext, "requestId">,
  code: MobileApiErrorCode,
  message: string,
  status: number
): NextResponse<MobileApiErrorResponse> {
  const body: MobileApiErrorResponse = {
    success: false,
    apiVersion: MOBILE_API_VERSION,
    requestId: context.requestId,
    serverTime: getMobileApiServerTimeForResponse(),
    error: {
      code,
      message,
    },
  }

  console.debug("[Mobile API]", {
    requestId: context.requestId,
    error: body.error,
    status,
  })

  return NextResponse.json(body, {
    status,
    headers: buildMobileResponseHeaders(context.requestId),
  })
}

export function handleMobileApiError(
  context: Pick<MobileRequestContext, "requestId">,
  error: unknown
): NextResponse<MobileApiErrorResponse> {
  if (error instanceof MobileApiError) {
    return mobileApiErrorResponse(
      context,
      error.code,
      error.message,
      error.status
    )
  }

  const message =
    error instanceof Error
      ? error.message
      : MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR

  console.error("[Mobile API]", {
    requestId: context.requestId,
    message,
    error,
  })

  return mobileApiErrorResponse(
    context,
    "INTERNAL_ERROR",
    MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
    500
  )
}
