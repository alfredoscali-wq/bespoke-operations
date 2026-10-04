import { NextResponse } from "next/server"

import { getNetworkAlarm } from "@/lib/network/alarms/queries"
import { requireNetworkReadContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ alarmId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  const { alarmId } = await context.params

  try {
    const client = await createClient()
    const alarm = await getNetworkAlarm(client, auth.companyId, alarmId)
    if (!alarm) {
      return NextResponse.json(
        { success: false, message: "Alarma no encontrada." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, alarm })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo cargar la alarma.",
      },
      { status: 500 }
    )
  }
}
