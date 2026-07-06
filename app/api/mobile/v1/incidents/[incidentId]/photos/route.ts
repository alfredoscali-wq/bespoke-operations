import { uploadMobileIncidentPhoto } from "@/lib/mobile/v1/incidents/incident-photo-service"
import {
  parseMobileIncidentPhotoForm,
  validateMobileIncidentPhotoRouteParam,
} from "@/lib/mobile/v1/incidents/validate-incident-photo-request"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ incidentId: string }>
}

export const runtime = "nodejs"

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { incidentId } = await context.params
    const contentType = request.headers.get("content-type")

    if (!contentType?.toLowerCase().includes("multipart/form-data")) {
      console.warn("[Mobile API incident-photos]", {
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
      console.warn("[Mobile API incident-photos]", {
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

    const photoRequest = parseMobileIncidentPhotoForm(formData, {
      requestId: mobileContext.request.requestId,
      contentType,
    })

    const validatedIncidentId = validateMobileIncidentPhotoRouteParam(
      incidentId.trim()
    )

    const result = await uploadMobileIncidentPhoto(
      mobileContext.auth,
      validatedIncidentId,
      photoRequest
    )

    return mobileApiSuccessResponse(mobileContext.request, result, 201)
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
