import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth/session"
import { canViewOperationsLiveMap } from "@/lib/gps-live/access"
import { GPS_LIVE_MAP_POLL_MS } from "@/lib/gps-live/constants"
import { loadOperationsLiveMap } from "@/lib/gps-live/live-map-service.server"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  if (!canViewOperationsLiveMap(sessionUser)) {
    return NextResponse.json(
      { success: false, message: "No tiene permiso para ver el mapa operativo." },
      { status: 403 }
    )
  }

  const companyId = sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "Empresa no resuelta para la sesión." },
      { status: 400 }
    )
  }

  const data = await loadOperationsLiveMap(companyId)

  return NextResponse.json({
    success: true,
    pollIntervalMs: data.pollIntervalMs ?? GPS_LIVE_MAP_POLL_MS,
    heartbeatIntervalSeconds: data.heartbeatIntervalSeconds,
    crews: data.crews,
  })
}
