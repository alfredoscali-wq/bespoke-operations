import type { MOBILE_API_VERSION } from "@/lib/mobile/v1/constants"
import type { MobileApiErrorCode } from "@/lib/mobile/v1/errors"

export type MobileApiVersion = typeof MOBILE_API_VERSION

export type MobileApiEnvelopeMeta = {
  apiVersion: MobileApiVersion
  requestId: string
  serverTime: string
}

export type MobileApiSuccessResponse<T> = MobileApiEnvelopeMeta & {
  success: true
  data: T
}

export type MobileApiErrorPayload = {
  code: MobileApiErrorCode
  message: string
}

export type MobileApiErrorResponse = MobileApiEnvelopeMeta & {
  success: false
  error: MobileApiErrorPayload
}
