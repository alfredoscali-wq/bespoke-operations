import { NextResponse } from "next/server"

import { requireSubscriptionsWriteContext } from "@/lib/subscriptions/route-context"
import {
  WHATSAPP_REQUEST_STATUSES,
  resolveWhatsappRequestUpdate,
  type WhatsappRequestStatus,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import {
  getWhatsappCommercialRequest,
  updateWhatsappCommercialRequest,
} from "@/lib/supabase/whatsapp-commercial-requests.queries"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isStatus(value: unknown): value is WhatsappRequestStatus {
  return (
    typeof value === "string" &&
    WHATSAPP_REQUEST_STATUSES.some((status) => status === value)
  )
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!REQUEST_ID.test(id)) {
    return NextResponse.json(
      { success: false, message: "La solicitud no existe." },
      { status: 404 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }
  const record = body as Record<string, unknown>
  if (!isStatus(record.status) || typeof record.operatorNotes !== "string") {
    return NextResponse.json(
      { success: false, message: "La resolución es inválida." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const current = await getWhatsappCommercialRequest(client, auth.companyId, id)
  if (current.error?.code === "NOT_FOUND") {
    return NextResponse.json(
      { success: false, message: "La solicitud no existe." },
      { status: 404 }
    )
  }
  if (current.error || !current.data) {
    return NextResponse.json(
      { success: false, message: current.error?.message ?? "No se pudo leer la solicitud." },
      { status: 400 }
    )
  }

  const next = resolveWhatsappRequestUpdate({
    current: current.data,
    status: record.status,
    operatorNotes: record.operatorNotes,
    actorId: auth.sessionUser.authUserId,
    now: new Date().toISOString(),
  })
  if (!next.ok) {
    return NextResponse.json({ success: false, message: next.message }, { status: 409 })
  }

  const saved = await updateWhatsappCommercialRequest(client, auth.companyId, next.request)
  if (saved.error) {
    return NextResponse.json(
      { success: false, message: saved.error.message },
      { status: 400 }
    )
  }
  return NextResponse.json({ success: true, item: saved.data })
}
