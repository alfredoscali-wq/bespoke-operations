import { NextResponse } from "next/server"

import { listNetworkDevices } from "@/lib/network/devices/queries"
import { requireNetworkReadContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const devices = await listNetworkDevices(client, auth.companyId)
    return NextResponse.json({ success: true, devices })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los dispositivos.",
      },
      { status: 500 }
    )
  }
}
