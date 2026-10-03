import { NextResponse } from "next/server"

import { requireNetworkReadContext } from "@/lib/network/route-context"
import { getNetworkTopologyPage } from "@/lib/network/topology/queries"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  try {
    const deviceId = new URL(request.url).searchParams.get("deviceId")
    const client = await createClient()
    const page = await getNetworkTopologyPage(client, auth.companyId, deviceId)
    return NextResponse.json({ success: true, ...page })
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
