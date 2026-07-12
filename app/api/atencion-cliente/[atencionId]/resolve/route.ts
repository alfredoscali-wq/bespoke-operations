import { resolveCustomerAtencionConsultation } from "@/lib/customer-atenciones/consultation-management.server"
import {
  consultationManagementResultToResponse,
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import { validateResolveConsultationResolution } from "@/lib/customer-atenciones/consultation-management"

export async function POST(
  request: Request,
  context: AtencionClienteRouteContext
) {
  const auth = await requireAtencionClienteMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const body = (await request.json().catch(() => null)) as
    | { resolution?: string }
    | null

  const resolutionResult = validateResolveConsultationResolution(body?.resolution)
  if (typeof resolutionResult !== "string") {
    return consultationManagementResultToResponse({
      ok: false,
      status: 400,
      message: resolutionResult.error,
      code: "CONSULTATION_RESOLUTION_REQUIRED",
    })
  }

  const { atencionId } = await context.params

  const result = await resolveCustomerAtencionConsultation({
    companyId: auth.companyId,
    atencionId,
    employeeId: auth.employeeId,
    resolution: resolutionResult,
  })

  return consultationManagementResultToResponse(result)
}
