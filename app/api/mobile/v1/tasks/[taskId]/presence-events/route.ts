import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"
import { registerMobileTaskPresenceEvent } from "@/lib/mobile/v1/presence/register-presence-event-service"
import { validateMobilePresenceEventRequest } from "@/lib/mobile/v1/presence/validate-presence-event-request"
import { validateMobileTaskDetailRequest } from "@/lib/mobile/v1/tasks/task-service"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { taskId } = await context.params
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

    const presenceRequest = validateMobilePresenceEventRequest(body)
    validateMobileTaskDetailRequest(taskId, presenceRequest.deviceId)

    const result = await registerMobileTaskPresenceEvent(
      mobileContext.auth,
      taskId.trim(),
      presenceRequest
    )

    return mobileApiSuccessResponse(
      mobileContext.request,
      result,
      result.duplicated ? 200 : 201
    )
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
