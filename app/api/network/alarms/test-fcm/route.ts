import { NextResponse } from "next/server"

import {
  cleanupTestFcmNetworkAlarm,
  createTestFcmNetworkAlarm,
} from "@/lib/network/alarms/test-fcm"
import { requireNetworkWriteContext } from "@/lib/network/route-context"
import { isAdministradorSessionUser } from "@/lib/roles/web-module-access"
import { createClient } from "@/lib/supabase/server"

async function requireTestFcmAlarmContext() {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth
  if (!isAdministradorSessionUser(auth.sessionUser)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Solo un administrador puede ejecutar esta prueba.",
        },
        { status: 403 }
      ),
    }
  }
  return auth
}

export async function POST(request: Request) {
  const auth = await requireTestFcmAlarmContext()
  if (!auth.ok) return auth.response

  // Tenant exclusively from the session. Ignore any companyId in the body.
  void (await request.json().catch(() => null))

  try {
    const client = await createClient()
    const result = await createTestFcmNetworkAlarm(client, auth.companyId)
    return NextResponse.json(
      {
        alarmId: result.alarmId,
        recipientCount: result.recipientCount,
        sent: result.sent,
        failed: result.failed,
        outcome: result.outcome,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear la alarma de prueba.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const auth = await requireTestFcmAlarmContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const result = await cleanupTestFcmNetworkAlarm(client, auth.companyId)
    return NextResponse.json({
      alarmIds: result.alarmIds,
      deviceIds: result.deviceIds,
      eventsRetained: result.eventsRetained,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo limpiar la alarma de prueba.",
      },
      { status: 500 }
    )
  }
}
