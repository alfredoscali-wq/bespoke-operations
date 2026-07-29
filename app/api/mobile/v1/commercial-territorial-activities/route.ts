import { createMobileTerritorialActivity, listMobileTerritorialActivities, validateMobileCreateTerritorialActivityRequest } from "@/lib/mobile/v1/commercial-territorial/territorial-activity-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function GET(request: Request) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const activities = await listMobileTerritorialActivities(mobileContext.auth)
    return mobileApiSuccessResponse(mobileContext.request, { activities })
  })
}

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

    const input = validateMobileCreateTerritorialActivityRequest(body)
    const activity = await createMobileTerritorialActivity(
      mobileContext.auth,
      input
    )
    return mobileApiSuccessResponse(mobileContext.request, { activity }, 201)
  })
}
