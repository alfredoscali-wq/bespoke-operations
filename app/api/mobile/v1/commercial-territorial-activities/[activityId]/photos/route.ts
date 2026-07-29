import { uploadMobileTerritorialActivityPhoto } from "@/lib/mobile/v1/commercial-territorial/territorial-activity-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ activityId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { activityId } = await context.params
    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
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
    } catch {
      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "No se pudo leer el formulario.",
        400
      )
    }

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "Archivo obligatorio.",
        400
      )
    }

    const result = await uploadMobileTerritorialActivityPhoto(
      mobileContext.auth,
      activityId,
      file
    )

    return mobileApiSuccessResponse(mobileContext.request, result, 201)
  })
}
