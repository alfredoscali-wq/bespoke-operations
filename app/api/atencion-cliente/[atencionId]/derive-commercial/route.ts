import { NextResponse } from "next/server"

import { recordAttentionTransferredActivity } from "@/lib/activity/domain/attention-activity"
import { activityActorFromSession } from "@/lib/activity/resolve-activity-actor"
import { deriveCommercialOpportunityFromCustomerService } from "@/lib/commercial/derive-from-customer-service"
import {
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"

/**
 * Completes Atención → Gestión Comercial handoff for a consultation already
 * marked as `contactar_cliente` (typically right after create).
 */
export async function POST(
  _request: Request,
  context: AtencionClienteRouteContext
) {
  const auth = await requireAtencionClienteMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const { atencionId } = await context.params
  if (!atencionId?.trim()) {
    return NextResponse.json(
      { success: false, message: "Consulta inválida." },
      { status: 400 }
    )
  }

  const body = (await _request.json().catch(() => null)) as
    | { detail?: string | null }
    | null

  const result = await deriveCommercialOpportunityFromCustomerService({
    companyId: auth.companyId,
    atencionId: atencionId.trim(),
    employeeId: auth.employeeId,
    detail: body?.detail ?? null,
  })

  if (!result) {
    return NextResponse.json(
      {
        success: false,
        message:
          "No se pudo crear la oportunidad comercial. Revisá los logs de derivación.",
      },
      { status: 500 }
    )
  }

  const actor = activityActorFromSession(auth.sessionUser)
  if (actor) {
    void recordAttentionTransferredActivity({
      actor,
      attentionId: atencionId.trim(),
      oldEmployeeId: null,
      newEmployeeId: auth.employeeId,
    })
  }

  return NextResponse.json({
    success: true,
    opportunityId: result.opportunityId,
    created: result.created,
  })
}
