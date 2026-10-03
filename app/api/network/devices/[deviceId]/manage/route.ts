import { NextResponse } from "next/server"

import { administerObservedNetworkDevice } from "@/lib/network/management/service"
import { requireNetworkWriteContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ deviceId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { deviceId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const intent = record.intent === "test" ? "test" : record.intent === "discover" ? "discover" : null
  if (!intent) {
    return NextResponse.json(
      { success: false, message: "La acción debe ser test o discover." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const result = await administerObservedNetworkDevice(client, auth.companyId, {
      deviceId,
      agentId: typeof record.agentId === "string" ? record.agentId : null,
      protocol: record.protocol,
      port: record.port,
      username: record.username,
      password: record.password,
      intent,
    })
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      )
    }
    return NextResponse.json({ success: true, ...result.result }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo administrar el dispositivo.",
      },
      { status: 500 }
    )
  }
}
