import { NextResponse } from "next/server"

import { searchBillingCustomers } from "@/lib/isp/billing-document-queries"
import { requireIspBillingReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  const query = new URL(request.url).searchParams.get("q") ?? ""
  try {
    const client = await createClient()
    const items = await searchBillingCustomers(client, auth.companyId, query)
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudieron buscar clientes.",
      },
      { status: 500 }
    )
  }
}
