import { MobileApiError } from "@/lib/mobile/v1/errors"
import { submitMobileTaskForApproval } from "@/lib/mobile/v1/tasks/task-submit-service"
import { validateMobileTaskSubmitRequest } from "@/lib/mobile/v1/tasks/validate-task-execution-request"
import { validateMobileTaskDetailRequest } from "@/lib/mobile/v1/tasks/task-service"
import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

/** Temporary: safe body shape for submit-for-approval 400 diagnosis. */
function describeSubmitBody(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object") {
    return {
      bodyType: body === null ? "null" : typeof body,
      keys: [],
    }
  }

  const record = body as Record<string, unknown>
  const trabajo = record.trabajoRealizado

  return {
    bodyType: "object",
    keys: Object.keys(record),
    hasDeviceId: typeof record.deviceId === "string",
    deviceIdPresent:
      typeof record.deviceId === "string" && record.deviceId.trim().length > 0,
    deviceIdType: typeof record.deviceId,
    hasTrabajoRealizado: Object.prototype.hasOwnProperty.call(
      record,
      "trabajoRealizado"
    ),
    trabajoRealizadoType: trabajo === null ? "null" : typeof trabajo,
    trabajoRealizadoLength:
      typeof trabajo === "string" ? trabajo.length : null,
    trabajoRealizadoTrimmedEmpty:
      typeof trabajo === "string" ? trabajo.trim().length === 0 : null,
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const { taskId } = await context.params
    let body: unknown

    try {
      body = await request.json()
    } catch {
      console.warn("[Mobile API][submit-for-approval]", {
        requestId: mobileContext.request.requestId,
        taskId,
        validation: "INVALID_JSON_BODY",
        httpStatus: 400,
        message: "Cuerpo JSON inválido.",
      })
      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "Cuerpo JSON inválido.",
        400
      )
    }

    console.warn("[Mobile API][submit-for-approval]", {
      requestId: mobileContext.request.requestId,
      taskId,
      step: "body_received",
      body: describeSubmitBody(body),
    })

    try {
      const submitRequest = validateMobileTaskSubmitRequest(body)
      validateMobileTaskDetailRequest(taskId, submitRequest.deviceId)

      console.warn("[Mobile API][submit-for-approval]", {
        requestId: mobileContext.request.requestId,
        taskId,
        step: "request_validation_ok",
        deviceIdPresent: true,
        trabajoRealizadoLength: submitRequest.trabajoRealizado.length,
      })

      const result = await submitMobileTaskForApproval(
        mobileContext.auth,
        taskId.trim(),
        submitRequest
      )

      return mobileApiSuccessResponse(mobileContext.request, result)
    } catch (error) {
      if (error instanceof MobileApiError) {
        console.warn("[Mobile API][submit-for-approval]", {
          requestId: mobileContext.request.requestId,
          taskId,
          validation: error.code,
          httpStatus: error.status,
          message: error.message,
          body: describeSubmitBody(body),
        })
      }
      throw error
    }
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
