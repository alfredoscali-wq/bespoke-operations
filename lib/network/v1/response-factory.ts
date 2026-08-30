import { NextResponse } from "next/server"

import { NETWORK_API_VERSION } from "@/lib/network/v1/constants"
import {
  getNetworkApiServerTime,
  type NetworkRequestContext,
} from "@/lib/network/v1/request-context"

type NetworkApiSuccessResponse<T> = {
  success: true
  apiVersion: typeof NETWORK_API_VERSION
  requestId: string
  serverTime: string
  data: T
}

export function networkApiSuccessResponse<T>(
  context: Pick<NetworkRequestContext, "requestId">,
  data: T,
  status = 200
): NextResponse<NetworkApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      apiVersion: NETWORK_API_VERSION,
      requestId: context.requestId,
      serverTime: getNetworkApiServerTime(),
      data,
    },
    {
      status,
      headers: { "X-Request-Id": context.requestId },
    }
  )
}
