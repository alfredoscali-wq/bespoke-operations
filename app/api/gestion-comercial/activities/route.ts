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

  const url = new URL(request.url)
  const opportunityId = url.searchParams.get("opportunityId")?.trim()
  if (!opportunityId) {
    return NextResponse.json(
      { success: false, message: "Debe indicar opportunityId." },
      { status: 400 }
    )
  }

  const limitParam = url.searchParams.get("limit")
  const offsetParam = url.searchParams.get("offset")
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined
  const offset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined

  const service = new CommercialActivityService()
  const [result, statsResult] = await Promise.all([
    service.listByOpportunity(auth.companyId, opportunityId, {
      ...(Number.isFinite(limit) ? { limit } : {}),
      ...(Number.isFinite(offset) ? { offset } : {}),
    }),
    service.getStats(auth.companyId, opportunityId),
  ])

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    activities: result.data,
    hasMore: result.hasMore ?? false,
    totalCount: result.totalCount ?? result.data?.length ?? 0,
    stats: statsResult.data ?? null,
  })
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
