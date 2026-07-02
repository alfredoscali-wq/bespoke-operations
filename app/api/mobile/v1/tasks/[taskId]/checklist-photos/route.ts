import { uploadMobileTaskChecklistPhoto } from "@/lib/mobile/v1/tasks/task-checklist-photo-service"
import {
  readRequiredFormFile,
  readRequiredFormString,
} from "@/lib/mobile/v1/tasks/validate-task-execution-request"
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
    let formData: FormData

    try {
      formData = await request.formData()
    } catch {
      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "Formulario inválido.",
        400
      )
    }

    const deviceId = readRequiredFormString(formData, "deviceId")
    const checklistItemId = readRequiredFormString(formData, "checklistItemId")
    const file = readRequiredFormFile(formData, "file")

    validateMobileTaskDetailRequest(taskId, deviceId)

    const result = await uploadMobileTaskChecklistPhoto(
      mobileContext.auth,
      taskId.trim(),
      {
        deviceId,
        checklistItemId,
        file,
      }
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
