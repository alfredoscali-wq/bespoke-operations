import { NextResponse } from "next/server"

import { CommercialActivityService } from "@/lib/commercial/services"
import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import type { CreateCommercialActivityPayload } from "@/lib/types/supabase/commercial-activities"

export async function GET(request: Request) {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const opportunityId = new URL(request.url).searchParams.get("opportunityId")?.trim()
  if (!opportunityId) {
    return NextResponse.json(
      { success: false, message: "Debe indicar opportunityId." },
      { status: 400 }
    )
  }

  const result = await new CommercialActivityService().listByOpportunity(
    auth.companyId,
    opportunityId
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, activities: result.data })
}

export async function POST(request: Request) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  let payload: CreateCommercialActivityPayload
  try {
    payload = (await request.json()) as CreateCommercialActivityPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const result = await new CommercialActivityService().create({
    ...payload,
    companyId: auth.companyId,
    employeeId: payload.employeeId ?? auth.employeeId,
    createdBy: auth.employeeId,
  })

  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo crear la actividad.",
      },
      { status: result.error?.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json(
    { success: true, activity: result.data },
    { status: 201 }
  )
}
