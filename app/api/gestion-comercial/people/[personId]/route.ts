import { NextResponse } from "next/server"

import { CommercialPeopleService } from "@/lib/commercial/services"
import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import type { UpdateCommercialPersonPayload } from "@/lib/types/supabase/commercial"

type RouteContext = {
  params: Promise<{ personId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const { personId } = await context.params
  const result = await new CommercialPeopleService().getById(personId)

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "NOT_FOUND" ? 404 : 500 }
    )
  }

  if (result.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Cliente no encontrado." },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, person: result.data })
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { personId } = await context.params

  let payload: UpdateCommercialPersonPayload
  try {
    payload = (await request.json()) as UpdateCommercialPersonPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const existing = await new CommercialPeopleService().getById(personId)
  if (existing.error || !existing.data) {
    return NextResponse.json(
      { success: false, message: existing.error?.message ?? "Cliente no encontrado." },
      { status: 404 }
    )
  }
  if (existing.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Cliente no encontrado." },
      { status: 404 }
    )
  }

  const result = await new CommercialPeopleService().update(personId, {
    ...payload,
    updatedBy: auth.employeeId,
  })

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json({ success: true, person: result.data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { personId } = await context.params
  const existing = await new CommercialPeopleService().getById(personId)
  if (existing.error || !existing.data) {
    return NextResponse.json(
      { success: false, message: existing.error?.message ?? "Cliente no encontrado." },
      { status: 404 }
    )
  }
  if (existing.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Cliente no encontrado." },
      { status: 404 }
    )
  }

  const result = await new CommercialPeopleService().delete(
    personId,
    auth.employeeId
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, person: result.data })
}
