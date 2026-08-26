import { NextResponse } from "next/server"

import { getBillingIssueContext } from "@/lib/isp/billing-document-queries"
import { requireIspBillingReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const context = await getBillingIssueContext(client, auth.companyId)
    return NextResponse.json({ success: true, context })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el contexto de facturación.",
      },
      { status: 500 }
    )
  }
}
