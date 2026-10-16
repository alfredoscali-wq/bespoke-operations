import { NextResponse } from "next/server"

import { listNetworkAlarmEvents } from "@/lib/network/alarms/events"
import { requireNetworkReadContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ alarmId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  const { alarmId } = await context.params

  try {
    const client = await createClient()
    const events = await listNetworkAlarmEvents(client, auth.companyId, alarmId)
    if (!events) {
      return NextResponse.json(
        { success: false, message: "Alarma no encontrada." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, events })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el historial de la alarma.",
      },
      { status: 500 }
    )
  }
}
