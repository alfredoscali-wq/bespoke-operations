import {
  hasMobileClientHeaders,
  readMobileClientHeaders,
  type MobileClientHeaders,
} from "@/lib/mobile/v1/mobile-headers"
import { createMobileRequestId } from "@/lib/mobile/v1/request-id"
import { getMobileApiServerTime } from "@/lib/mobile/v1/server-time"

export type MobileRequestContext = {
  requestId: string
  mobileHeaders: MobileClientHeaders
}

export function createMobileRequestContext(request: Request): MobileRequestContext {
  const requestId = createMobileRequestId()
  const mobileHeaders = readMobileClientHeaders(request)

  logMobileClientHeadersDebug(requestId, mobileHeaders)

  return {
    requestId,
    mobileHeaders,
  }
}

function logMobileClientHeadersDebug(
  requestId: string,
  headers: MobileClientHeaders
): void {
  if (!hasMobileClientHeaders(headers)) {
    return
  }

  console.debug("[Mobile API]", {
    requestId,
    mobileHeaders: headers,
  })
}

export function getMobileApiServerTimeForResponse(): string {
  return getMobileApiServerTime()
}
