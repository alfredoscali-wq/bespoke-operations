import { extractRequestAuditContext } from "@/lib/audit/request-context"
import { recordUserLoginAudit } from "@/lib/audit/users-audit.server"
import { authenticateMobileLogin } from "@/lib/mobile/v1/auth/login-service"
import { validateMobileLoginRequest } from "@/lib/mobile/v1/auth/validate-login-request"
import {
  handleMobileApiError,
  mobileApiErrorResponse,
} from "@/lib/mobile/v1/error-factory"
import { createMobileRequestContext } from "@/lib/mobile/v1/request-context"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"
import { startPerformanceTrace } from "@/lib/performance"

export async function POST(request: Request) {
  const context = createMobileRequestContext(request)
  const perf = startPerformanceTrace("MOBILE LOGIN ROUTE", {
    layer: "backend",
    requestId: context.requestId,
  })
  let body: unknown

  try {
    body = await perf.span("Parse body", async () => request.json())
  } catch {
    perf.fail()
    return mobileApiErrorResponse(
      context,
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  try {
    const loginRequest = perf.spanSync("Validate", () =>
      validateMobileLoginRequest(body)
    )
    const result = await perf.span("Authenticate", () =>
      authenticateMobileLogin(loginRequest)
    )
    const requestContext = extractRequestAuditContext(request)

    try {
      await perf.span("Audit", () =>
        recordUserLoginAudit(result.sessionUser, {
          ...requestContext,
          userAgent:
            requestContext.userAgent ??
            `BespokeFieldAgent/${loginRequest.appVersion} (${loginRequest.platform}; device:${loginRequest.deviceId})`,
        })
      )
    } catch {
      // Login succeeded; audit failure must not block mobile authentication.
    }

    const { sessionUser: _sessionUser, ...loginData } = result
    perf.finish()
    return mobileApiSuccessResponse(context, loginData)
  } catch (error) {
    perf.fail(error)
    return handleMobileApiError(context, error)
  }
}

export async function GET(request: Request) {
  const context = createMobileRequestContext(request)

  return mobileApiErrorResponse(
    context,
    "INVALID_REQUEST",
    "Método no permitido.",
    405
  )
}
