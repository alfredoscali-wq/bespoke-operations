import { NextResponse } from "next/server"

import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { loadPlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/load-read-model.server"
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
          "Solo administración, supervisión y gerencia pueden acceder al Timeline Operativo.",
      },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const date =
    optionalParam(searchParams.get("date")) ??
    new Date().toISOString().slice(0, 10)
  const crewId = optionalParam(searchParams.get("crewId"))

  if (!crewId) {
    return NextResponse.json(
      { success: false, message: "Debe indicar la cuadrilla." },
      { status: 400 }
    )
  }

  const companyId = resolveTenantCompanyId(sessionUser)

  try {
    const model = await loadPlanningTimelineReadModel({
      companyId,
      date,
      crewId,
    })

    return NextResponse.json({
      success: true,
      date,
      crewId,
      model,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el Timeline Operativo."

    const status = message.includes("no encontrada") ? 404 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
