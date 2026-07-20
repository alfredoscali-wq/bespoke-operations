import { NextResponse } from "next/server"

import { validateRegisterInteractionInput } from "@/lib/customer-atenciones/consultation-interaction"
import {
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import {
  registerCustomerAtencionInteraction,
  type ConsultationInteractionServerResult,
} from "@/lib/customer-atenciones/consultation-management.server"

function interactionResultToResponse(
  result: ConsultationInteractionServerResult
) {
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        code: result.code,
      },
      { status: result.status }
    )
  }

  return NextResponse.json({
    success: true,
    atencionId: result.data.atencionId,
    eventId: result.data.eventId,
    interactionKind: result.data.interactionKind,
    interactionResult: result.data.interactionResult,
    nextActionAt: result.data.nextActionAt,
    status: result.data.status,
    nextStep: result.data.nextStep,
    managementReleased: result.data.managementReleased,
  })
}

export async function POST(
  request: Request,
  context: AtencionClienteRouteContext
) {
  const auth = await requireAtencionClienteMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const body = (await request.json().catch(() => null)) as
    | {
        interactionKind?: string
        interactionResult?: string | null
        detail?: string
        nextActionAt?: string | null
      }
    | null

  const validated = validateRegisterInteractionInput({
    kind: body?.interactionKind ?? "",
    result: body?.interactionResult,
    detail: body?.detail,
    nextActionAt: body?.nextActionAt,
  })

  if ("error" in validated) {
    return interactionResultToResponse({
      ok: false,
      status: 400,
      message: validated.error,
      code: "INTERACTION_DETAIL_REQUIRED",
    })
  }

  const { atencionId } = await context.params

  const result = await registerCustomerAtencionInteraction({
    companyId: auth.companyId,
    atencionId,
    employeeId: auth.employeeId,
    interactionKind: validated.kind,
    interactionResult: validated.result,
    detail: validated.detail,
    nextActionAt: validated.nextActionAt,
  })

  return interactionResultToResponse(result)
}
