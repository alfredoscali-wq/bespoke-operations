import { uploadMobileTaskChecklistPhoto } from "@/lib/mobile/v1/tasks/task-checklist-photo-service"
import { parseMobileTaskChecklistPhotoForm } from "@/lib/mobile/v1/tasks/validate-task-execution-request"
import { validateMobileTaskDetailRequest } from "@/lib/mobile/v1/tasks/task-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export const runtime = "nodejs"

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { taskId } = await context.params
    const contentType = request.headers.get("content-type")

    if (!contentType?.toLowerCase().includes("multipart/form-data")) {
      console.warn("[Mobile API checklist-photos]", {
        requestId: mobileContext.request.requestId,
        stage: "invalid_content_type",
        contentType,
      })

      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "Content-Type debe ser multipart/form-data.",
        400
      )
    }

    let formData: FormData

    try {
      formData = await request.formData()
    } catch (error) {
      console.warn("[Mobile API checklist-photos]", {
        requestId: mobileContext.request.requestId,
        stage: "form_data_parse_failed",
        message: error instanceof Error ? error.message : String(error),
      })

      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "No se pudo leer el formulario multipart.",
        400
      )
    }

    const checklistRequest = parseMobileTaskChecklistPhotoForm(formData, {
      requestId: mobileContext.request.requestId,
      contentType,
    })

    validateMobileTaskDetailRequest(taskId, checklistRequest.deviceId)

    const result = await uploadMobileTaskChecklistPhoto(
      mobileContext.auth,
      taskId.trim(),
      checklistRequest
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
