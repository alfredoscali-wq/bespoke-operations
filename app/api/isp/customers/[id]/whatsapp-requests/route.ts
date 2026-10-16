import { NextResponse } from "next/server"

import { ISP_SUBSCRIBER_NOT_FOUND_MESSAGE } from "@/lib/isp/constants"
import { getIspCustomerDetail } from "@/lib/isp/queries"
import { requireIspReadContext } from "@/lib/isp/route-context"
import { listWhatsappRequestsForCustomer } from "@/lib/supabase/whatsapp-commercial-requests.queries"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const detail = await getIspCustomerDetail(client, auth.companyId, id)
    if (!detail) {
      return NextResponse.json(
        { success: false, message: ISP_SUBSCRIBER_NOT_FOUND_MESSAGE },
        { status: 404 }
      )
    }

    const history = await listWhatsappRequestsForCustomer(client, auth.companyId, id)
    if (history.error) {
      return NextResponse.json({ success: false, message: history.error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true, items: history.data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo cargar el historial.",
      },
      { status: 500 }
    )
  }
}
