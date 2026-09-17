import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"
import { registerMobileGpsHeartbeat } from "@/lib/mobile/v1/gps/gps-heartbeat-service"
import { validateMobileGpsHeartbeatRequest } from "@/lib/mobile/v1/gps/validate-gps-heartbeat-request"

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

    const heartbeatRequest = validateMobileGpsHeartbeatRequest(body)
    const result = await registerMobileGpsHeartbeat(
      context.auth,
      heartbeatRequest
    )

    return mobileApiSuccessResponse(context.request, result)
  })
}

export async function GET(request: Request) {
  return handleProtectedMobileRoute(request, async ({ request: mobileRequest }) =>
    mobileApiErrorResponse(
      mobileRequest,
      "INVALID_REQUEST",
      "Método no permitido.",
      405
    )
  )
}
