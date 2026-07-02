import { refreshMobileSession } from "@/lib/mobile/v1/auth/refresh-service"
import { validateMobileRefreshRequest } from "@/lib/mobile/v1/auth/validate-refresh-request"
import {
  handleMobileApiError,
  mobileApiErrorResponse,
} from "@/lib/mobile/v1/error-factory"
import { createMobileRequestContext } from "@/lib/mobile/v1/request-context"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function POST(request: Request) {
  const context = createMobileRequestContext(request)
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return mobileApiErrorResponse(
      context,
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  try {
    const refreshRequest = validateMobileRefreshRequest(body)
    const result = await refreshMobileSession(refreshRequest)

    return mobileApiSuccessResponse(context, result)
  } catch (error) {
    return handleMobileApiError(context, error)
  }
}

export async function GET(request: Request) {
  const context = createMobileRequestContext(request)

  return mobileApiErrorResponse(
    context,
    "INVALID_REQUEST",
    "Método no permitido.",
    405
  )
}
