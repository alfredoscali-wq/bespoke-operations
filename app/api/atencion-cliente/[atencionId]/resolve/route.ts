import { resolveCustomerAtencionConsultation } from "@/lib/customer-atenciones/consultation-management.server"
import { requireCustomerActionAuthContext } from "@/lib/customer-atenciones/action-auth.server"
import {
  consultationManagementResultToResponse,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import { validateConsultationFollowUpActions } from "@/lib/customer-atenciones/consultation-follow-up"
import { validateResolveConsultationResolution } from "@/lib/customer-atenciones/consultation-management"
import {
  addAtcActionTimer,
  measureAtcActionPhase,
  runWithAtcActionPerf,
} from "@/lib/customer-service/performance/action-breakdown"

export async function POST(
  request: Request,
  context: AtencionClienteRouteContext
) {
  return runWithAtcActionPerf("resolve", async () => {
    // Sprint 40.0 — auth, body, and params are independent.
    const [auth, body, params] = await Promise.all([
      measureAtcActionPhase("authMs", () => requireCustomerActionAuthContext()),
      request.json().catch(() => null) as Promise<{
        resolution?: string
        followUpActions?: unknown
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

    const resolutionResult = validateResolveConsultationResolution(
      body?.resolution
    )
    if (typeof resolutionResult !== "string") {
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
        message: resolutionResult.error,
        code: "CONSULTATION_RESOLUTION_REQUIRED",
      })
    }

    const followUpResult = validateConsultationFollowUpActions(
      body?.followUpActions
    )
    if (!Array.isArray(followUpResult)) {
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
        message: followUpResult.error,
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

    const result = await resolveCustomerAtencionConsultation({
      companyId: auth.companyId,
      atencionId,
      employeeId: auth.employeeId,
      resolution: resolutionResult,
      followUpActions: followUpResult,
    })

    return measureAtcActionPhase("responseBuildMs", async () =>
      consultationManagementResultToResponse(result)
    )
  })
}
