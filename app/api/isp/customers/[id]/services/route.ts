import { NextResponse } from "next/server"

import { getIspCatalogItem } from "@/lib/isp/catalog-queries"
import {
  validateSubscriberServiceCreate,
} from "@/lib/isp/subscriber-service-integrity"
import { createIspSubscriberService } from "@/lib/isp/subscriber-service-queries"
import { requireIspWriteContext } from "@/lib/isp/route-context"
import type { IspConnectionDraft } from "@/lib/isp/types"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

type CreateBody = {
  catalogId?: string
  monthlyFee?: string | number | null
  activationDate?: string | null
  commercialStatus?: string | null
  notes?: string | null
  includeConnection?: boolean
  replacedServiceId?: string | null
  connection?: {
    connectionType?: string | null
    pppoeUsername?: string | null
    pppoePassword?: string | null
    technicalProfile?: string | null
    technicalProfileId?: string | null
    ipAddress?: string | null
    prefixLength?: string | null
    gateway?: string | null
    vlan?: string | null
    coreName?: string | null
    coreProfileId?: string | null
    technicalStatus?: string | null
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id: customerId } = await context.params

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const catalog = body.catalogId
      ? await getIspCatalogItem(client, auth.companyId, body.catalogId)
      : null
    const check = validateSubscriberServiceCreate({
      customerId,
      actorCompanyId: auth.companyId,
      customerCompanyId: auth.companyId,
      subscriberExists: true,
      catalog,
      catalogId: body.catalogId,
      monthlyFee: body.monthlyFee,
      activationDate: body.activationDate,
      includeConnection: Boolean(body.includeConnection),
      connection: body.connection,
    })
    if (!check.valid) {
      return NextResponse.json(
        { success: false, message: check.message },
        { status: 400 }
      )
    }

    const result = await createIspSubscriberService(client, {
      customerId,
      catalogId: body.catalogId!,
      monthlyFee: body.monthlyFee,
      activationDate: body.activationDate,
      notes: body.notes,
      includeConnection: Boolean(body.includeConnection),
      replacedServiceId: body.replacedServiceId,
      connection: body.connection as Partial<IspConnectionDraft> | undefined,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el servicio.",
      },
      { status: 400 }
    )
  }
}
