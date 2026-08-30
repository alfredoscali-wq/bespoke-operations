import { NextResponse } from "next/server"

import { getNetworkHomeSummary } from "@/lib/network/agents/queries"
import { listNetworkSites } from "@/lib/network/sites/queries"
import { requireNetworkReadContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const [summary, sites] = await Promise.all([
      getNetworkHomeSummary(client, auth.companyId),
      listNetworkSites(client, auth.companyId),
    ])
    return NextResponse.json({ success: true, summary, sites })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar Network.",
      },
      { status: 500 }
    )
  }
}
