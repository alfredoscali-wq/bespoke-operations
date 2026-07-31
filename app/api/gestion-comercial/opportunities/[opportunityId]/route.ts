import { NextResponse } from "next/server"

import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivity } from "@/lib/activity/emit-activity"
import { activityActorFromSession } from "@/lib/activity/resolve-activity-actor"
import { CommercialOpportunityService } from "@/lib/commercial/services"
import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import type { UpdateCommercialOpportunityPayload } from "@/lib/types/supabase/commercial"

type RouteContext = {
  params: Promise<{ opportunityId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const { opportunityId } = await context.params
  const result = await new CommercialOpportunityService().getById(opportunityId)

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "NOT_FOUND" ? 404 : 500 }
    )
  }

  if (result.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Oportunidad no encontrada." },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, opportunity: result.data })
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { opportunityId } = await context.params

  let payload: UpdateCommercialOpportunityPayload
  try {
    payload = (await request.json()) as UpdateCommercialOpportunityPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const existing = await new CommercialOpportunityService().getById(opportunityId)
  if (existing.error || !existing.data) {
    return NextResponse.json(
      {
        success: false,
        message: existing.error?.message ?? "Oportunidad no encontrada.",
      },
      { status: 404 }
    )
  }
  if (existing.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Oportunidad no encontrada." },
      { status: 404 }
    )
  }

  const result = await new CommercialOpportunityService().update(opportunityId, {
    ...payload,
    updatedBy: auth.employeeId,
  })

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "VALIDATION" ? 400 : 500 }
    )
  }

  if (
    payload.etiquetaId !== undefined &&
    (existing.data.etiquetaId ?? null) !== (result.data?.etiquetaId ?? null)
  ) {
    const actor = activityActorFromSession(auth.sessionUser)
    if (actor) {
      void emitActivity({
        actor,
        module: "customers",
        entityType: "commercial_opportunity",
        entityId: opportunityId,
        action: ACTIVITY_EVENT_ACTIONS.CUSTOMER_TAG_CHANGED,
        metadata: {
          oldEtiquetaId: existing.data.etiquetaId ?? null,
          newEtiquetaId: result.data?.etiquetaId ?? null,
        },
      })
    }
  }

  return NextResponse.json({ success: true, opportunity: result.data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { opportunityId } = await context.params
  const existing = await new CommercialOpportunityService().getById(opportunityId)
  if (existing.error || !existing.data) {
    return NextResponse.json(
      {
        success: false,
        message: existing.error?.message ?? "Oportunidad no encontrada.",
      },
      { status: 404 }
    )
  }
  if (existing.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Oportunidad no encontrada." },
      { status: 404 }
    )
  }

  const result = await new CommercialOpportunityService().delete(
    opportunityId,
    auth.employeeId
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, opportunity: result.data })
}
