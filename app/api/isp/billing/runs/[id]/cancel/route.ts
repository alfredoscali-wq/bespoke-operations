import { NextResponse } from "next/server"

import {
  billingRunCancelMessage,
  cancelIspBillingRun,
} from "@/lib/isp/billing-run-queries"
import { requireIspBillingWriteContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const detail = await cancelIspBillingRun(client, auth.companyId, id)
    return NextResponse.json({
      success: true,
      message: billingRunCancelMessage(),
      detail,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cancelar la preparación.",
      },
      { status: 400 }
    )
  }
}
