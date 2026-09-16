import { getMobileProjectMap } from "@/lib/mobile/v1/projects/project-map-service"
import { validateMobileProjectMapRequest } from "@/lib/mobile/v1/projects/project-map-access"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { projectId } = await context.params
    const url = new URL(request.url)
    const query = validateMobileProjectMapRequest(
      projectId,
      url.searchParams.get("taskId"),
      url.searchParams.get("deviceId")
    )
    const result = await getMobileProjectMap(
      mobileContext.auth,
      query.projectId,
      query.taskId,
      query.deviceId
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
