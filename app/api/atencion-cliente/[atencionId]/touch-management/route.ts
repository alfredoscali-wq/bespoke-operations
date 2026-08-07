import { touchCustomerAtencionManagementActivity } from "@/lib/customer-atenciones/consultation-management.server"
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
  return runWithAtcActionPerf("touch-management", async () => {
    // Sprint 40.0 — auth and params are independent.
    const [auth, params] = await Promise.all([
      measureAtcActionPhase("authMs", () => requireCustomerActionAuthContext()),
      context.params,
    ])
    if (!auth.ok) {
      return auth.response
    }

    const { atencionId } = params

    const result = await touchCustomerAtencionManagementActivity({
      companyId: auth.companyId,
      atencionId,
      employeeId: auth.employeeId,
    })

    return measureAtcActionPhase("responseBuildMs", async () =>
      consultationManagementResultToResponse(result)
    )
  })
}
