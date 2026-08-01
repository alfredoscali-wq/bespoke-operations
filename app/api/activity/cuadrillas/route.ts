import { NextResponse } from "next/server"

import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { loadCrewsReadModel } from "@/lib/analysis/crews/load-read-model.server"
import type { CrewsPeriodPreset } from "@/lib/analysis/crews/period"
import { getSessionUser } from "@/lib/auth/session"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"

function optionalParam(value: string | null): string | undefined {
  const normalized = value?.trim() ?? ""
  return normalized || undefined
}

const PRESETS: ReadonlySet<CrewsPeriodPreset> = new Set([
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "custom",
])

function parsePreset(value: string | undefined): CrewsPeriodPreset {
  if (value && PRESETS.has(value as CrewsPeriodPreset)) {
    return value as CrewsPeriodPreset
  }
  return "today"
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
          "Solo administración, supervisión y gerencia pueden acceder a Cuadrillas.",
      },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const preset = parsePreset(optionalParam(searchParams.get("preset")))
  const dateFrom = optionalParam(searchParams.get("dateFrom"))
  const dateTo = optionalParam(searchParams.get("dateTo"))
  const companyId = resolveTenantCompanyId(sessionUser)

  try {
    if (preset === "custom" && (!dateFrom || !dateTo)) {
      return NextResponse.json(
        {
          success: false,
          message: "El período personalizado requiere fecha Desde y Hasta.",
        },
        { status: 400 }
      )
    }

    const model = await loadCrewsReadModel({
      companyId,
      preset,
      dateFrom,
      dateTo,
    })

    return NextResponse.json({
      success: true,
      model,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar Cuadrillas."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
