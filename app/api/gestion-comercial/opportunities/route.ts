import { NextResponse } from "next/server"

import { CommercialOpportunityService } from "@/lib/commercial/services"
import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import type { CreateCommercialOpportunityPayload } from "@/lib/types/supabase/commercial"

export async function GET() {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const result = await new CommercialOpportunityService().list(auth.companyId)
  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, opportunities: result.data })
}

export async function POST(request: Request) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  let payload: CreateCommercialOpportunityPayload
  try {
    payload = (await request.json()) as CreateCommercialOpportunityPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const result = await new CommercialOpportunityService().create({
    ...payload,
    companyId: auth.companyId,
    createdBy: auth.employeeId,
  })

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json(
    { success: true, opportunity: result.data },
    { status: 201 }
  )
}
