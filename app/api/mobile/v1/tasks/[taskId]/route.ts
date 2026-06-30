import {
  getMobileTaskDetail,
  validateMobileTaskDetailRequest,
} from "@/lib/mobile/v1/tasks/task-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { taskId } = await context.params
    const url = new URL(request.url)
    const query = validateMobileTaskDetailRequest(
      taskId,
      url.searchParams.get("deviceId")
    )
    const result = await getMobileTaskDetail(
      mobileContext.auth,
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
