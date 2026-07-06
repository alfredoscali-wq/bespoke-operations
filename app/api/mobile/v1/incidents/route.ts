import { createMobileIncident } from "@/lib/mobile/v1/incidents/incident-service"
import { validateMobileCreateIncidentRequest } from "@/lib/mobile/v1/incidents/validate-incident-request"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function POST(request: Request) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "Cuerpo JSON inválido.",
        400
      )
    }

    const incidentRequest = validateMobileCreateIncidentRequest(body)
    const result = await createMobileIncident(mobileContext.auth, incidentRequest)

    return mobileApiSuccessResponse(mobileContext.request, result, 201)
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
