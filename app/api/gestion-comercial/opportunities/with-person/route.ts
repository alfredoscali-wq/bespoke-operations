import { NextResponse } from "next/server"

import type { CommercialCreateOpportunityBundleInput } from "@/lib/commercial/create-opportunity"
import { requireGestionComercialMutationContext } from "@/lib/commercial/route-context"
import { CommercialOpportunityService } from "@/lib/commercial/services"

export async function POST(request: Request) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  let bundle: CommercialCreateOpportunityBundleInput
  try {
    bundle = (await request.json()) as CommercialCreateOpportunityBundleInput
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const result = await new CommercialOpportunityService().createWithPerson({
    companyId: auth.companyId,
    createdBy: auth.employeeId,
    bundle,
  })

  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo crear la oportunidad.",
      },
      { status: result.error?.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json(
    {
      success: true,
      person: result.data.person,
      opportunity: result.data.opportunity,
      matchedExistingPerson: result.data.matchedExistingPerson,
      notice: result.data.notice,
      message: "Oportunidad creada correctamente.",
    },
    { status: 201 }
  )
}
