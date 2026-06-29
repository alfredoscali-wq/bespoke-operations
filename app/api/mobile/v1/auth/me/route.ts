import { mapMobileAuthProfile } from "@/lib/mobile/v1/auth/map-mobile-auth-profile"
import { requireAuthenticatedUser } from "@/lib/mobile/v1/auth/mobile-auth-helpers"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function GET(request: Request) {
  return handleProtectedMobileRoute(request, async (context) => {
    const auth = requireAuthenticatedUser(context)

    return mobileApiSuccessResponse(
      context.request,
      mapMobileAuthProfile(auth)
    )
  })
}
