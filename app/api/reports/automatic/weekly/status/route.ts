import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { getWeeklyReportRunStatus } from "@/lib/reports/automatic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  try {
    const status = await getWeeklyReportRunStatus()

    return NextResponse.json({
      success: true,
      status,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo obtener el estado del reporte."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
