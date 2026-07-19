import { deferCustomerAtencionConsultation } from "@/lib/customer-atenciones/consultation-management.server"
import {
  consultationManagementResultToResponse,
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import { validateDeferConsultationNextStep } from "@/lib/customer-atenciones/consultation-management"

export async function POST(
  request: Request,
  context: AtencionClienteRouteContext
) {
  const auth = await requireAtencionClienteMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const body = (await request.json().catch(() => null)) as
    | { nextStep?: string; detail?: string }
    | null

  const nextStepResult = validateDeferConsultationNextStep(body?.nextStep)
  if (typeof nextStepResult !== "string") {
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
    return consultationManagementResultToResponse({
      ok: false,
      status: 400,
      message: "Completá el detalle de la gestión.",
      code: "CONSULTATION_INVALID_PARAMETERS",
    })
  }

  const { atencionId } = await context.params

  const result = await deferCustomerAtencionConsultation({
    companyId: auth.companyId,
    atencionId,
    employeeId: auth.employeeId,
    nextStep: nextStepResult,
    detail: detailRaw,
  })

  return consultationManagementResultToResponse(result)
}
