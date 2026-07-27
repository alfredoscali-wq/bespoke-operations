import { NextResponse } from "next/server"

import { CommercialOpportunityService } from "@/lib/commercial/services"
import { requireGestionComercialMutationContext } from "@/lib/commercial/route-context"
import type { BulkAssignCommercialOpportunitiesPayload } from "@/lib/types/supabase/commercial"

export async function PATCH(request: Request) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  let body: BulkAssignCommercialOpportunitiesPayload
  try {
    body = (await request.json()) as BulkAssignCommercialOpportunitiesPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const result = await new CommercialOpportunityService().bulkAssign(
    auth.companyId,
    {
      opportunityIds: body.opportunityIds ?? [],
      assignedEmployeeId: body.assignedEmployeeId ?? null,
      updatedBy: auth.employeeId,
    }
  )

  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo asignar responsables.",
      },
      { status: result.error?.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json({
    success: true,
    opportunities: result.data,
  })
}
