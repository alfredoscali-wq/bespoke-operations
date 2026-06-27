import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { listAutomaticReportHistory } from "@/lib/reports/automatic"
import { WEEKLY_REPORT_ID } from "@/lib/reports/automatic/config"

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
    const items = await listAutomaticReportHistory({
      reportType: WEEKLY_REPORT_ID,
      limit: 100,
    })

    return NextResponse.json({ success: true, items })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar el historial."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
