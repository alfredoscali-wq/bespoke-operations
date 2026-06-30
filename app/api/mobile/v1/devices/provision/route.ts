import { provisionMobileDevice } from "@/lib/mobile/v1/devices/provision-service"
import { validateMobileProvisionDeviceRequest } from "@/lib/mobile/v1/devices/validate-provision-request"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
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

    const provisionRequest = validateMobileProvisionDeviceRequest(body)
    const result = await provisionMobileDevice(context.auth, provisionRequest)

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
