import { NextResponse } from "next/server"

import { CommercialPeopleService } from "@/lib/commercial/services"
import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import type { CreateCommercialPersonPayload } from "@/lib/types/supabase/commercial"

export async function GET() {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const result = await new CommercialPeopleService().list(auth.companyId)
  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "NOT_FOUND" ? 404 : 500 }
    )
  }

  return NextResponse.json({ success: true, people: result.data })
}

export async function POST(request: Request) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  let payload: CreateCommercialPersonPayload
  try {
    payload = (await request.json()) as CreateCommercialPersonPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const result = await new CommercialPeopleService().create({
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

  return NextResponse.json({ success: true, person: result.data }, { status: 201 })
}
