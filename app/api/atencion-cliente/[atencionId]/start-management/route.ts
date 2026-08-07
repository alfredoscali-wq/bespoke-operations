import { startCustomerAtencionManagement } from "@/lib/customer-atenciones/consultation-management.server"
import { requireCustomerActionAuthContext } from "@/lib/customer-atenciones/action-auth.server"
import {
  consultationManagementResultToResponse,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import {
  measureAtcActionPhase,
  runWithAtcActionPerf,
} from "@/lib/customer-service/performance/action-breakdown"

export async function POST(
  _request: Request,
  context: AtencionClienteRouteContext
) {
  return runWithAtcActionPerf("start-management", async () => {
    // Sprint 44.0 — await params first (avoid any Promise.all edge with Next params).
    // Auth is independent of params; still overlap after params resolve.
    const params = await context.params
    const atencionId =
      typeof params.atencionId === "string" ? params.atencionId.trim() : ""

    const auth = await measureAtcActionPhase("authMs", () =>
      requireCustomerActionAuthContext()
    )
    if (!auth.ok) {
      return auth.response
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        "[ATC START ROUTE]",
        atencionId,
        auth.companyId,
        auth.employeeId
      )
    }

    if (!atencionId) {
      return consultationManagementResultToResponse({
        ok: false,
        status: 400,
        message: "Identificador de consulta inválido.",
        code: "CONSULTATION_INVALID_PARAMETERS",
      })
    }

    const result = await startCustomerAtencionManagement({
      companyId: auth.companyId,
      atencionId,
      employeeId: auth.employeeId,
    })

    if (!result.ok && process.env.NODE_ENV === "development") {
      console.error(
        "[ATC START ROUTE FAIL]",
        result.status,
        result.code,
        result.message,
        { atencionId, companyId: auth.companyId, employeeId: auth.employeeId }
      )
    }

    return measureAtcActionPhase("responseBuildMs", async () =>
      consultationManagementResultToResponse(result)
    )
  })
}
