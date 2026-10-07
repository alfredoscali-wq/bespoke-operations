import { NextResponse } from "next/server"

import { requireNetworkReadContext } from "@/lib/network/route-context"
import { listAvailableCuratedTopologyDevices } from "@/lib/network/topology/queries"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const coreDeviceId = url.searchParams.get("coreDeviceId")
  const parentDeviceId = url.searchParams.get("parentDeviceId")

  try {
    const client = await createClient()
    const devices = await listAvailableCuratedTopologyDevices(
      client,
      auth.companyId,
      coreDeviceId,
      parentDeviceId
    )
    return NextResponse.json({ success: true, devices })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los dispositivos disponibles.",
      },
      { status: 500 }
    )
  }
}
