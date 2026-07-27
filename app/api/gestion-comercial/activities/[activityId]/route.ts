import { NextResponse } from "next/server"

import { CommercialActivityService } from "@/lib/commercial/services"
import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import type { UpdateCommercialActivityPayload } from "@/lib/types/supabase/commercial-activities"

type RouteContext = {
  params: Promise<{ activityId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const { activityId } = await context.params
  const result = await new CommercialActivityService().getById(activityId)

  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "Actividad no encontrada.",
      },
      { status: result.error?.code === "NOT_FOUND" ? 404 : 500 }
    )
  }

  if (result.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Actividad no encontrada." },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, activity: result.data })
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { activityId } = await context.params
  let payload: UpdateCommercialActivityPayload
  try {
    payload = (await request.json()) as UpdateCommercialActivityPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const existing = await new CommercialActivityService().getById(activityId)
  if (existing.error || !existing.data) {
    return NextResponse.json(
      {
        success: false,
        message: existing.error?.message ?? "Actividad no encontrada.",
      },
      { status: 404 }
    )
  }
  if (existing.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Actividad no encontrada." },
      { status: 404 }
    )
  }

  const result = await new CommercialActivityService().update(activityId, {
    ...payload,
    updatedBy: auth.employeeId,
  })

  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo actualizar la actividad.",
      },
      { status: result.error?.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json({ success: true, activity: result.data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { activityId } = await context.params
  const existing = await new CommercialActivityService().getById(activityId)
  if (existing.error || !existing.data) {
    return NextResponse.json(
      {
        success: false,
        message: existing.error?.message ?? "Actividad no encontrada.",
      },
      { status: 404 }
    )
  }
  if (existing.data.companyId !== auth.companyId) {
    return NextResponse.json(
      { success: false, message: "Actividad no encontrada." },
      { status: 404 }
    )
  }

  const result = await new CommercialActivityService().delete(
    activityId,
    auth.employeeId
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, activity: result.data })
}
