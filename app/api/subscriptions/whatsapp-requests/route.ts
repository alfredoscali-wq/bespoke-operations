import { NextResponse } from "next/server"

import { requireSubscriptionsReadContext } from "@/lib/subscriptions/route-context"
import {
  WHATSAPP_REQUEST_STATUSES,
  type WhatsappRequestStatus,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import { listWhatsappCommercialRequests } from "@/lib/supabase/whatsapp-commercial-requests.queries"
import { createClient } from "@/lib/supabase/server"

function isStatus(value: string | null): value is WhatsappRequestStatus | "all" {
  return value === "all" || WHATSAPP_REQUEST_STATUSES.some((status) => status === value)
}

export async function GET(request: Request) {
  const auth = await requireSubscriptionsReadContext()
  if (!auth.ok) return auth.response

  const status = new URL(request.url).searchParams.get("status") ?? "all"
  if (!isStatus(status)) {
    return NextResponse.json(
      { success: false, message: "Estado de solicitud inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await listWhatsappCommercialRequests(client, auth.companyId, status)
  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 400 }
    )
  }
  return NextResponse.json({ success: true, items: result.data })
}
