import { NextResponse } from "next/server"

import { MOBILE_API_VERSION } from "@/lib/mobile/v1/constants"
import type { MobileRequestContext } from "@/lib/mobile/v1/request-context"
import { getMobileApiServerTimeForResponse } from "@/lib/mobile/v1/request-context"
import type { MobileApiSuccessResponse } from "@/lib/mobile/v1/types/responses"

function buildMobileResponseHeaders(requestId: string): HeadersInit {
  return {
    "X-Request-Id": requestId,
  }
}

export function mobileApiSuccessResponse<T>(
  context: Pick<MobileRequestContext, "requestId">,
  data: T,
  status = 200
): NextResponse<MobileApiSuccessResponse<T>> {
  const body: MobileApiSuccessResponse<T> = {
    success: true,
    apiVersion: MOBILE_API_VERSION,
    requestId: context.requestId,
    serverTime: getMobileApiServerTimeForResponse(),
    data,
  }

  return NextResponse.json(body, {
    status,
    headers: buildMobileResponseHeaders(context.requestId),
  })
}
