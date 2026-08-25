import { NextResponse } from "next/server"

import { listIspConnections } from "@/lib/isp/queries"
import { ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE } from "@/lib/isp/integrity"
import { canCreateOrphanConnection } from "@/lib/isp/subscriber-service-integrity"
import {
  createIspServiceConnection,
  getIspContractedService,
} from "@/lib/isp/subscriber-service-queries"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import type { IspConnectionDraft } from "@/lib/isp/types"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)

  try {
    const client = await createClient()
    const connections = await listIspConnections(client, auth.companyId, {
      search: url.searchParams.get("search") ?? "",
      commercialStatus: url.searchParams.get("commercialStatus") ?? "all",
      technicalStatus: url.searchParams.get("technicalStatus") ?? "all",
      technology: url.searchParams.get("technology") ?? "all",
      connectionType: url.searchParams.get("connectionType") ?? "all",
      coreName: url.searchParams.get("coreName") ?? "",
    })
    return NextResponse.json({ success: true, connections })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las conexiones.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  let body: { serviceId?: string; connection?: IspConnectionDraft }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  if (!body.serviceId?.trim()) {
    return NextResponse.json(
      {
        success: false,
        message:
          canCreateOrphanConnection().message ||
          ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE,
      },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const service = await getIspContractedService(
      client,
      auth.companyId,
      body.serviceId
    )
    if (!service) {
      return NextResponse.json(
        {
          success: false,
          message: "El servicio contratado no pertenece a esta empresa.",
        },
        { status: 404 }
      )
    }

    const result = await createIspServiceConnection(client, {
      serviceId: body.serviceId,
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
