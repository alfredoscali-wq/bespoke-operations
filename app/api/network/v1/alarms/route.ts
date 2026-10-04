import { NextResponse } from "next/server"

import {
  isNetworkAlarmSeverity,
  isNetworkAlarmStatus,
} from "@/lib/network/alarms/contract"
import { listNetworkAlarms } from "@/lib/network/alarms/queries"
import { requireNetworkReadContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const severityParam = url.searchParams.get("severity")
  const deviceId = url.searchParams.get("deviceId")?.trim() || undefined

  const status = statusParam && isNetworkAlarmStatus(statusParam) ? statusParam : undefined
  const severity =
    severityParam && isNetworkAlarmSeverity(severityParam) ? severityParam : undefined

  if (statusParam && !status) {
    return NextResponse.json(
      { success: false, message: "Estado de alarma inválido." },
      { status: 400 }
    )
  }
  if (severityParam && !severity) {
    return NextResponse.json(
      { success: false, message: "Severidad de alarma inválida." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const alarms = await listNetworkAlarms(client, auth.companyId, {
      status,
      severity,
      deviceId,
    })
    return NextResponse.json({ success: true, alarms })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudieron listar las alarmas.",
      },
      { status: 500 }
    )
  }
}
