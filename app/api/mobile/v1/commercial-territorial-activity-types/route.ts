import { listMobileTerritorialActivityTypes } from "@/lib/mobile/v1/commercial-territorial/territorial-activity-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function GET(request: Request) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const types = await listMobileTerritorialActivityTypes(mobileContext.auth)
    return mobileApiSuccessResponse(mobileContext.request, { types })
  })
}
