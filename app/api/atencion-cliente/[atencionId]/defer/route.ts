import { deferCustomerAtencionConsultation } from "@/lib/customer-atenciones/consultation-management.server"
import { requireCustomerActionAuthContext } from "@/lib/customer-atenciones/action-auth.server"
import {
  consultationManagementResultToResponse,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import { validateDeferConsultationNextStep } from "@/lib/customer-atenciones/consultation-management"
import {
  addAtcActionTimer,
  measureAtcActionPhase,
  runWithAtcActionPerf,
} from "@/lib/customer-service/performance/action-breakdown"

export async function POST(
  request: Request,
  context: AtencionClienteRouteContext
) {
  return runWithAtcActionPerf("defer", async () => {
    // Sprint 40.0 — auth, body, and params are independent.
    const [auth, body, params] = await Promise.all([
      measureAtcActionPhase("authMs", () => requireCustomerActionAuthContext()),
      request.json().catch(() => null) as Promise<{
        nextStep?: string
        detail?: string
      } | null>,
      context.params,
    ])
    if (!auth.ok) {
      return auth.response
    }

    const transformStarted =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now()

    const nextStepResult = validateDeferConsultationNextStep(body?.nextStep)
    if (typeof nextStepResult !== "string") {
      addAtcActionTimer(
        "transformMs",
        (typeof performance !== "undefined" &&
        typeof performance.now === "function"
          ? performance.now()
          : Date.now()) - transformStarted
      )
      return consultationManagementResultToResponse({
        ok: false,
        status: 400,
        message: nextStepResult.error,
        code: "CONSULTATION_NEXT_STEP_REQUIRED",
      })
    }

    const detailRaw =
      typeof body?.detail === "string" ? body.detail.trim() : ""
    if (!detailRaw) {
      addAtcActionTimer(
        "transformMs",
        (typeof performance !== "undefined" &&
        typeof performance.now === "function"
          ? performance.now()
          : Date.now()) - transformStarted
      )
      return consultationManagementResultToResponse({
        ok: false,
        status: 400,
        message: "Completá el detalle de la gestión.",
        code: "CONSULTATION_INVALID_PARAMETERS",
      })
    }

    addAtcActionTimer(
      "transformMs",
      (typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now()) - transformStarted
    )

    const { atencionId } = params

    const result = await deferCustomerAtencionConsultation({
      companyId: auth.companyId,
      atencionId,
      employeeId: auth.employeeId,
      nextStep: nextStepResult,
      detail: detailRaw,
    })

    return measureAtcActionPhase("responseBuildMs", async () =>
      consultationManagementResultToResponse(result)
    )
  })
}
