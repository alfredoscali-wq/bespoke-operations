import { NextResponse } from "next/server"

import { getNocMonitorPage } from "@/lib/network/noc/view"
import { requireNetworkReadContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const page = await getNocMonitorPage(client, auth.companyId)
    return NextResponse.json({ success: true, ...page })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el monitor NOC.",
      },
      { status: 500 }
    )
  }
}
