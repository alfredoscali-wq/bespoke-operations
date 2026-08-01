import { NextResponse } from "next/server"

import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { drainAnalysisCompanyDayEvents } from "@/lib/analysis/queries/drain-company-day-events"
import { loadSituationRoomViaDualRead } from "@/lib/indicator-engine/facade/situation-room-dual-read"
import { getSessionUser } from "@/lib/auth/session"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"

function optionalParam(value: string | null): string | undefined {
  const normalized = value?.trim() ?? ""
  return normalized || undefined
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  if (!canAccessOperationsIntelligence(sessionUser.systemRole)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Solo administración, supervisión y gerencia pueden acceder a la Sala de Situación.",
      },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const date =
    optionalParam(searchParams.get("date")) ??
    new Date().toISOString().slice(0, 10)
  const dateFrom = toTimelineDateFromInput(date)
  const dateTo = toTimelineDateToInput(date)

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { success: false, message: "Fecha inválida." },
      { status: 400 }
    )
  }

  const companyId = resolveTenantCompanyId(sessionUser)

  try {
    const events = await drainAnalysisCompanyDayEvents({
      companyId,
      dateFrom,
      dateTo,
    })

    // Dual Read / Snapshot integration: reuses `events` already loaded.
    // Official brief is V1 by default (dual); V2 only when engineMode=v2 + Comparator match.
    const { brief } = loadSituationRoomViaDualRead({
      companyId,
      date,
      events,
    })

    return NextResponse.json({
      success: true,
      date,
      brief,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar la Sala de Situación."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
