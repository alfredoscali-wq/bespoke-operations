import { NextResponse } from "next/server"

import { ISP_BILLING_DOCUMENT_CANCELLED_MESSAGE } from "@/lib/isp/billing-constants"
import { cancelIspBillingDocument } from "@/lib/isp/billing-document-queries"
import { requireIspBillingWriteContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const document = await cancelIspBillingDocument(client, auth.companyId, id)
    return NextResponse.json({
      success: true,
      message: ISP_BILLING_DOCUMENT_CANCELLED_MESSAGE,
      document,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo anular el comprobante.",
      },
      { status: 400 }
    )
  }
}
