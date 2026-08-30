import { NextResponse } from "next/server"

import { requireNetworkReadContext } from "@/lib/network/route-context"
import { getNetworkTopologyGraph } from "@/lib/network/topology/queries"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const graph = await getNetworkTopologyGraph(client, auth.companyId)
    return NextResponse.json({ success: true, graph })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la topología.",
      },
      { status: 500 }
    )
  }
}
