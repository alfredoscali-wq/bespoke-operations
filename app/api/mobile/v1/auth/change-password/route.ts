import { changeMobilePassword } from "@/lib/mobile/v1/auth/change-password-service"
import { extractBearerToken } from "@/lib/mobile/v1/auth/extract-bearer-token"
import { requireAuthenticatedUser } from "@/lib/mobile/v1/auth/mobile-auth-helpers"
import { validateMobileChangePasswordRequest } from "@/lib/mobile/v1/auth/validate-change-password-request"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import {
  mobileApiErrorResponse,
} from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"
import { MOBILE_API_ERROR_MESSAGES } from "@/lib/mobile/v1/errors"

export async function POST(request: Request) {
  return handleProtectedMobileRoute(
    request,
    async (context) => {
      const accessToken = extractBearerToken(request)
      if (!accessToken) {
        return mobileApiErrorResponse(
          context.request,
          "UNAUTHORIZED",
          MOBILE_API_ERROR_MESSAGES.UNAUTHORIZED,
          401
        )
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return mobileApiErrorResponse(
          context.request,
          "INVALID_REQUEST",
          "Cuerpo JSON inválido.",
          400
        )
      }

      const changeRequest = validateMobileChangePasswordRequest(body)
      const auth = requireAuthenticatedUser(context)
      await changeMobilePassword({
        accessToken,
        auth,
        newPassword: changeRequest.newPassword,
      })

      return mobileApiSuccessResponse(context.request, { ok: true })
    },
    { allowPasswordChangeRequired: true }
  )
}

export async function GET(request: Request) {
  return handleProtectedMobileRoute(
    request,
    async (context) =>
      mobileApiErrorResponse(
        context.request,
        "INVALID_REQUEST",
        "Método no permitido.",
        405
      ),
    { allowPasswordChangeRequired: true }
  )
}
