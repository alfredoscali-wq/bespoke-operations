import { NextResponse } from "next/server"

import { listNetworkDeviceStatusHistory } from "@/lib/network/monitoring/status-history"
import { requireNetworkReadContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ deviceId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  const { deviceId } = await context.params

  try {
    const client = await createClient()
    const history = await listNetworkDeviceStatusHistory(
      client,
      auth.companyId,
      deviceId
    )
    if (!history) {
      return NextResponse.json(
        { success: false, message: "Dispositivo no encontrado." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, events: history.events })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el histórico.",
      },
      { status: 500 }
    )
  }
}
