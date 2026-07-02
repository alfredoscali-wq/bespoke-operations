import { startMobileTask } from "@/lib/mobile/v1/tasks/task-start-service"
import { validateMobileTaskStartRequest } from "@/lib/mobile/v1/tasks/validate-task-start-request"
import { validateMobileTaskDetailRequest } from "@/lib/mobile/v1/tasks/task-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

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

    const startRequest = validateMobileTaskStartRequest(body)

    validateMobileTaskDetailRequest(taskId, startRequest.deviceId)

    const result = await startMobileTask(
      mobileContext.auth,
      taskId.trim(),
      startRequest
    )

    return mobileApiSuccessResponse(mobileContext.request, result)
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
