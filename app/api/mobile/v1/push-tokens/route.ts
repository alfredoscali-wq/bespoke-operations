import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { registerMobilePushToken } from "@/lib/mobile/v1/push/register-push-token-service"
import { validateMobilePushTokenRequest } from "@/lib/mobile/v1/push/validate-push-token-request"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function POST(request: Request) {
  return handleProtectedMobileRoute(request, async (context) => {
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return mobileApiErrorResponse(
        context.request,
        "INVALID_REQUEST",
        "Cuerpo JSON inválido.",
        400
      )
    }

    const pushRequest = validateMobilePushTokenRequest(body)
    const result = await registerMobilePushToken(context.auth, pushRequest)

    return mobileApiSuccessResponse(context.request, result)
  })
}

export async function GET(request: Request) {
  return handleProtectedMobileRoute(request, async (context) =>
    mobileApiErrorResponse(
      context.request,
      "INVALID_REQUEST",
      "Método no permitido.",
      405
    )
  )
}
