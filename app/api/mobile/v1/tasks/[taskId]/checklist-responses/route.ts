import { updateMobileTaskChecklistResponse } from "@/lib/mobile/v1/tasks/task-checklist-service"
import { validateMobileTaskChecklistResponseRequest } from "@/lib/mobile/v1/tasks/validate-task-execution-request"
import { validateMobileTaskDetailRequest } from "@/lib/mobile/v1/tasks/task-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function PUT(request: Request, context: RouteContext) {
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

    const checklistRequest = validateMobileTaskChecklistResponseRequest(body)
    validateMobileTaskDetailRequest(taskId, checklistRequest.deviceId)

    const result = await updateMobileTaskChecklistResponse(
      mobileContext.auth,
      taskId.trim(),
      checklistRequest
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
