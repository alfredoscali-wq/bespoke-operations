import { NextResponse } from "next/server"

import { validateRegisterInteractionInput } from "@/lib/customer-atenciones/consultation-interaction"
import {
  buildCustomerInteractionHistorialDetail,
  validateCustomerInteractionInput,
} from "@/lib/customer-atenciones/customer-interaction-catalog"
import {
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import {
  registerCustomerAtencionInteraction,
  type ConsultationInteractionServerResult,
} from "@/lib/customer-atenciones/consultation-management.server"
import { createAdminClient } from "@/lib/supabase/admin"

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
        /** Sprint 1.1C unified client contact */
        clientInteraction?: {
          medio?: string
          resultado?: string
          observations?: string | null
          nextStep?: string | null
          customerId?: string | null
        } | null
      }
    | null

  const { atencionId } = await context.params

  if (body?.clientInteraction) {
    const validated = validateCustomerInteractionInput({
      medium: body.clientInteraction.medio,
      result:
        body.clientInteraction.resultado ?? body.interactionResult ?? null,
      observations: body.clientInteraction.observations,
      nextStep: body.clientInteraction.nextStep,
    })

    if ("error" in validated) {
      return interactionResultToResponse({
        ok: false,
        status: 400,
        message: validated.error,
        code: "INTERACTION_DETAIL_REQUIRED",
      })
    }

    const admin = createAdminClient()
    const { data: atencionRow } = await admin
      .from("customer_atenciones")
      .select("customer_id, next_step")
      .eq("id", atencionId)
      .eq("company_id", auth.companyId)
      .maybeSingle()

    const previousNextStep =
      typeof atencionRow?.next_step === "string" ? atencionRow.next_step : null
    const customerId =
      body.clientInteraction.customerId?.trim() ||
      (typeof atencionRow?.customer_id === "string"
        ? atencionRow.customer_id
        : null)

    const detail = buildCustomerInteractionHistorialDetail({
      medium: validated.medium,
      result: validated.result,
      observations: validated.observations,
      nextStep: validated.nextStep,
      previousNextStep,
    })

    const result = await registerCustomerAtencionInteraction({
      companyId: auth.companyId,
      atencionId,
      employeeId: auth.employeeId,
      interactionKind: "contact",
      interactionResult: validated.result,
      detail,
      nextActionAt: null,
      clientInteraction: {
        medio: validated.medium,
        nextStep: validated.nextStep ?? previousNextStep,
        customerId,
      },
    })

    return interactionResultToResponse(result)
  }

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
