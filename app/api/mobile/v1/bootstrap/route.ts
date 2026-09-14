import { bootstrapMobileCompany } from "@/lib/mobile/v1/bootstrap/bootstrap-service"
import { validateMobileBootstrapRequest } from "@/lib/mobile/v1/bootstrap/validate-bootstrap-request"
import {
  handleMobileApiError,
  mobileApiErrorResponse,
} from "@/lib/mobile/v1/error-factory"
import { handlePublicMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

export async function POST(request: Request) {
  return handlePublicMobileRoute(request, async (context) => {
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return mobileApiErrorResponse(
        context,
        "INVALID_REQUEST",
        "Cuerpo JSON inválido.",
        400
      )
    }

    try {
      const bootstrapRequest = validateMobileBootstrapRequest(body)
      const data = await bootstrapMobileCompany(bootstrapRequest.companyCode)
      return mobileApiSuccessResponse(context, data)
    } catch (error) {
      return handleMobileApiError(context, error)
    }
  })
}

export async function GET(request: Request) {
  return handlePublicMobileRoute(request, async (context) =>
    mobileApiErrorResponse(
      context,
      "INVALID_REQUEST",
      "Método no permitido.",
      405
    )
  )
}
