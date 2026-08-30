import { NextResponse } from "next/server"

import { NETWORK_API_VERSION } from "@/lib/network/v1/constants"
import {
  NETWORK_API_ERROR_MESSAGES,
  NetworkApiError,
  type NetworkApiErrorCode,
} from "@/lib/network/v1/errors"
import {
  getNetworkApiServerTime,
  type NetworkRequestContext,
} from "@/lib/network/v1/request-context"

type NetworkApiErrorResponse = {
  success: false
  apiVersion: typeof NETWORK_API_VERSION
  requestId: string
  serverTime: string
  error: { code: NetworkApiErrorCode; message: string }
}

function buildHeaders(requestId: string): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "X-Request-Id": requestId,
  }
}

export function networkApiErrorResponse(
  context: Pick<NetworkRequestContext, "requestId">,
  code: NetworkApiErrorCode,
  message: string,
  status: number
): NextResponse<NetworkApiErrorResponse> {
  const body: NetworkApiErrorResponse = {
    success: false,
    apiVersion: NETWORK_API_VERSION,
    requestId: context.requestId,
    serverTime: getNetworkApiServerTime(),
    error: { code, message },
  }

  return NextResponse.json(body, {
    status,
    headers: buildHeaders(context.requestId),
  })
}

export function handleNetworkApiError(
  context: Pick<NetworkRequestContext, "requestId">,
  error: unknown
): NextResponse<NetworkApiErrorResponse> {
  if (error instanceof NetworkApiError) {
    return networkApiErrorResponse(
      context,
      error.code,
      error.message,
      error.status
    )
  }

  console.error("[Network API]", {
    requestId: context.requestId,
    error,
  })

  return networkApiErrorResponse(
    context,
    "INTERNAL_ERROR",
    NETWORK_API_ERROR_MESSAGES.INTERNAL_ERROR,
    500
  )
}
