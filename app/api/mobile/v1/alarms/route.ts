import { listMobileNetworkAlarms } from "@/lib/mobile/v1/alarms/list-mobile-network-alarms"
import { requireAuthenticatedUser } from "@/lib/mobile/v1/auth/mobile-auth-helpers"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function GET(request: Request) {
  return handleProtectedMobileRoute(request, async (context) => {
    const auth = requireAuthenticatedUser(context)
    const url = new URL(request.url)
    const data = await listMobileNetworkAlarms(
      auth,
      url.searchParams.get("companyId")
    )
    return mobileApiSuccessResponse(context.request, data)
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
