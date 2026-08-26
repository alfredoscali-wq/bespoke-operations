import { NextResponse } from "next/server"

import { listBillingCustomerServices } from "@/lib/isp/billing-document-queries"
import { requireIspBillingReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ customerId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  const { customerId } = await context.params
  try {
    const client = await createClient()
    const items = await listBillingCustomerServices(
      client,
      auth.companyId,
      customerId
    )
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los servicios.",
      },
      { status: 500 }
    )
  }
}
