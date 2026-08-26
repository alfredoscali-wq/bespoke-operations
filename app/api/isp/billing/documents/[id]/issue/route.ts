import { NextResponse } from "next/server"

import { ISP_BILLING_DOCUMENT_ISSUED } from "@/lib/isp/billing-constants"
import { issueIspBillingDocument } from "@/lib/isp/billing-document-queries"
import { requireIspBillingWriteContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const document = await issueIspBillingDocument(client, auth.companyId, id)
    return NextResponse.json({
      success: true,
      message: ISP_BILLING_DOCUMENT_ISSUED,
      document,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo emitir el comprobante.",
      },
      { status: 400 }
    )
  }
}
