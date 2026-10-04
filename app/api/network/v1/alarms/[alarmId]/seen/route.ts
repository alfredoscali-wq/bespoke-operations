import { NextResponse } from "next/server"

import { markNetworkAlarmSeen } from "@/lib/network/alarms/queries"
import { requireNetworkWriteContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ alarmId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { alarmId } = await context.params

  try {
    const client = await createClient()
    const alarm = await markNetworkAlarmSeen(client, {
      companyId: auth.companyId,
      alarmId,
    })
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
          error instanceof Error ? error.message : "No se pudo marcar la alarma como vista.",
      },
      { status: 500 }
    )
  }
}
