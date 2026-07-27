import { NextResponse } from "next/server"

import { CommercialOpportunityService } from "@/lib/commercial/services"
import { requireGestionComercialMutationContext } from "@/lib/commercial/route-context"

type RouteContext = {
  params: Promise<{ opportunityId: string }>
}

/** Marks a derivation/opportunity as opened by the seller (first dossier visit). */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { opportunityId } = await context.params
  const service = new CommercialOpportunityService()
  const existing = await service.getById(opportunityId)

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

  const result = await service.markSellerOpened(opportunityId, auth.employeeId)
  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo marcar como abierta.",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, opportunity: result.data })
}
