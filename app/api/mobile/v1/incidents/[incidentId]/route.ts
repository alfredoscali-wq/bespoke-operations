import { getMobileIncidentById } from "@/lib/mobile/v1/incidents/incident-service"
import { validateMobileIncidentIdParam } from "@/lib/mobile/v1/incidents/validate-incident-request"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ incidentId: string }>
}

function readDeviceId(value: string | null): string {
  if (!value?.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Campo requerido: deviceId.",
      400
    )
  }

  return value.trim()
}

export async function GET(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { incidentId } = await context.params
    const url = new URL(request.url)
    const deviceId = readDeviceId(url.searchParams.get("deviceId"))
    const validatedIncidentId = validateMobileIncidentIdParam(incidentId.trim())

    const result = await getMobileIncidentById(
      mobileContext.auth,
      validatedIncidentId,
      deviceId
    )

    return mobileApiSuccessResponse(mobileContext.request, result)
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
