import { cancelCustomerAtencionManagement } from "@/lib/customer-atenciones/consultation-management.server"
import {
  consultationManagementResultToResponse,
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"

export async function POST(
  _request: Request,
  context: AtencionClienteRouteContext
) {
  const auth = await requireAtencionClienteMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const { atencionId } = await context.params

  const result = await cancelCustomerAtencionManagement({
    companyId: auth.companyId,
    atencionId,
    employeeId: auth.employeeId,
  })

  return consultationManagementResultToResponse(result)
}
