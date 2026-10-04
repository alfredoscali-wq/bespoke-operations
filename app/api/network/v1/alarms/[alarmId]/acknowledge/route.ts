import { NextResponse } from "next/server"

import { acknowledgeNetworkAlarm } from "@/lib/network/alarms/queries"
import { requireNetworkWriteContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ alarmId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { alarmId } = await context.params

  try {
    const client = await createClient()
    const result = await acknowledgeNetworkAlarm(client, {
      companyId: auth.companyId,
      alarmId,
      actor: {
        employeeId: auth.sessionUser.employeeId,
        authUserId: auth.sessionUser.authUserId,
      },
    })
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409
      const message =
        result.reason === "not_found"
          ? "Alarma no encontrada."
          : "La alarma ya está resuelta."
      return NextResponse.json({ success: false, message }, { status })
    }
    return NextResponse.json({ success: true, alarm: result.alarm })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo tomar la alarma.",
      },
      { status: 500 }
    )
  }
}
