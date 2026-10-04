import { NextResponse } from "next/server"

import { resolveNetworkAlarm } from "@/lib/network/alarms/queries"
import { requireNetworkWriteContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ alarmId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { alarmId } = await context.params

  let resolutionNote: string | null = null
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      const body: unknown = await request.json()
      if (body && typeof body === "object" && "note" in body) {
        const note = (body as { note?: unknown }).note
        if (note != null && typeof note !== "string") {
          return NextResponse.json(
            { success: false, message: "La nota de resolución debe ser texto." },
            { status: 400 }
          )
        }
        resolutionNote = typeof note === "string" ? note : null
      }
    } catch {
      return NextResponse.json(
        { success: false, message: "Cuerpo JSON inválido." },
        { status: 400 }
      )
    }
  }

  try {
    const client = await createClient()
    const result = await resolveNetworkAlarm(client, {
      companyId: auth.companyId,
      alarmId,
      actor: {
        employeeId: auth.sessionUser.employeeId,
        authUserId: auth.sessionUser.authUserId,
      },
      resolutionNote,
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
          error instanceof Error ? error.message : "No se pudo resolver la alarma.",
      },
      { status: 500 }
    )
  }
}
