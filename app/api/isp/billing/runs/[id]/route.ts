import { NextResponse } from "next/server"

import { getIspBillingRun } from "@/lib/isp/billing-run-queries"
import { requireIspBillingReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const detail = await getIspBillingRun(client, auth.companyId, id)
    return NextResponse.json({ success: true, detail })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la corrida.",
      },
      { status: 404 }
    )
  }
}
