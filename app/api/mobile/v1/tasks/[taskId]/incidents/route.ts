import { reportMobileTaskIncident } from "@/lib/mobile/v1/tasks/task-incident-report-service"
import { validateMobileTaskReportIncidentRequest } from "@/lib/mobile/v1/tasks/validate-task-execution-request"
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

    const incidentRequest = validateMobileTaskReportIncidentRequest(body)
    validateMobileTaskDetailRequest(taskId, incidentRequest.deviceId)

    const result = await reportMobileTaskIncident(
      mobileContext.auth,
      taskId.trim(),
      incidentRequest
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
