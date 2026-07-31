import { NextResponse } from "next/server"

import { ACTIVITY_TIMELINE_PAGE_SIZE } from "@/lib/activity/activity-timeline-types"
import { getActivityEvents } from "@/lib/activity/query-service"
import { aggregateWorkforceMonitorRows } from "@/lib/activity/workforce-monitor"
import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import { getSessionUser } from "@/lib/auth/session"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"

function optionalParam(value: string | null): string | undefined {
  const normalized = value?.trim() ?? ""
  return normalized || undefined
}

function canAccessWorkforceMonitor(
  systemRole: string | null | undefined
): boolean {
  return (
    systemRole === "administrador" ||
    systemRole === "supervisor" ||
    systemRole === "administrativo"
  )
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  if (!canAccessWorkforceMonitor(sessionUser.systemRole)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Solo administración, supervisión y gerencia pueden acceder al Workforce Monitor.",
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
    const events = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const page = await getActivityEvents({
        companyId,
        dateFrom,
        dateTo,
        order: "ASC",
        limit: ACTIVITY_TIMELINE_PAGE_SIZE,
        offset,
      })

      events.push(...page.items)
      hasMore = page.hasMore
      offset += page.items.length
      if (page.items.length === 0) break
    }

    const rows = aggregateWorkforceMonitorRows(events)

    return NextResponse.json({
      success: true,
      date,
      rows,
      totalEvents: events.length,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el Workforce Monitor."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
