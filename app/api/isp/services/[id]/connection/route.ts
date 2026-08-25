import { NextResponse } from "next/server"

import { ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE } from "@/lib/isp/integrity"
import { canCreateConnectionForContractedService } from "@/lib/isp/subscriber-service-integrity"
import {
  createIspServiceConnection,
  getIspContractedService,
} from "@/lib/isp/subscriber-service-queries"
import { requireIspWriteContext } from "@/lib/isp/route-context"
import type { IspConnectionDraft } from "@/lib/isp/types"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id: serviceId } = await context.params

  let body: { connection?: IspConnectionDraft }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const service = await getIspContractedService(client, auth.companyId, serviceId)
    if (!service) {
      return NextResponse.json(
        { success: false, message: "El servicio contratado no pertenece a esta empresa." },
        { status: 404 }
      )
    }

    const graph = canCreateConnectionForContractedService({
      serviceId,
      serviceCustomerId: service.customerId,
      customerId: service.customerId,
      serviceCompanyId: service.companyId,
      connectionCompanyId: auth.companyId,
    })
    if (!graph.allowed) {
      return NextResponse.json(
        { success: false, message: graph.message ?? ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE },
        { status: 400 }
      )
    }

    const result = await createIspServiceConnection(client, {
      serviceId,
      connection: body.connection ?? ({} as IspConnectionDraft),
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear la conexión.",
      },
      { status: 400 }
    )
  }
}
