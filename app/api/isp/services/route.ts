import { NextResponse } from "next/server"

import { listIspUnconnectedServices } from "@/lib/isp/subscriber-service-queries"
import { requireIspReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const unconnected = url.searchParams.get("unconnected") === "true"

  if (!unconnected) {
    return NextResponse.json(
      { success: false, message: "Indique un filtro válido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const services = await listIspUnconnectedServices(client, auth.companyId)
    return NextResponse.json({ success: true, services })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los servicios.",
      },
      { status: 500 }
    )
  }
}
