import { NextResponse } from "next/server"

import { getIspContractedService, updateIspContractedService } from "@/lib/isp/subscriber-service-queries"
import {
  parseContractedPrice,
  ISP_CONTRACTED_PRICE_NEGATIVE_MESSAGE,
  resolveCommercialStatusOnServiceUpdate,
} from "@/lib/isp/subscriber-service-integrity"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const service = await getIspContractedService(client, auth.companyId, id)
    if (!service) {
      return NextResponse.json(
        { success: false, message: "Servicio contratado no encontrado." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, service })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el servicio.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: {
    monthlyFee?: string | number | null
    activationDate?: string | null
    commercialStatus?: string | null
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const fee = parseContractedPrice(body.monthlyFee)
  if (fee != null && fee < 0) {
    return NextResponse.json(
      { success: false, message: ISP_CONTRACTED_PRICE_NEGATIVE_MESSAGE },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const existing = await getIspContractedService(client, auth.companyId, id)
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Servicio contratado no encontrado." },
        { status: 404 }
      )
    }
    const commercialStatus = resolveCommercialStatusOnServiceUpdate({
      requested: body.commercialStatus,
      existingStatus: existing.commercialStatus,
      activationDate: body.activationDate ?? existing.activationDate,
    })
    const result = await updateIspContractedService(client, {
      serviceId: id,
      monthlyFee: body.monthlyFee,
      activationDate: body.activationDate,
      commercialStatus,
      notes: body.notes,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el servicio.",
      },
      { status: 400 }
    )
  }
}
