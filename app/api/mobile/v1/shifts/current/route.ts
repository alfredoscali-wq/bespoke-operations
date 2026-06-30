import { getCurrentMobileShift } from "@/lib/mobile/v1/shifts/shift-service"
import { validateMobileShiftCurrentQuery } from "@/lib/mobile/v1/shifts/validate-shift-request"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function GET(request: Request) {
  return handleProtectedMobileRoute(request, async (context) => {
    const url = new URL(request.url)
    const query = validateMobileShiftCurrentQuery(url.searchParams.get("deviceId"))
    const result = await getCurrentMobileShift(context.auth, query.deviceId)

    return mobileApiSuccessResponse(context.request, result)
  })
}

export async function POST(request: Request) {
  return handleProtectedMobileRoute(request, async (context) =>
    mobileApiErrorResponse(
      context.request,
      "INVALID_REQUEST",
      "Método no permitido.",
      405
    )
  )
}
