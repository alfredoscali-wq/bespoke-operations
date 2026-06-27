import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import {
  runWeeklyAutomaticReport,
  sendLatestStoredWeeklyReport,
} from "@/lib/reports/automatic"
import { getLatestAutomaticReportHistory } from "@/lib/reports/automatic/services/report-history"
import { WEEKLY_REPORT_ID } from "@/lib/reports/automatic/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  try {
    const latest = await getLatestAutomaticReportHistory({
      reportType: WEEKLY_REPORT_ID,
      requirePdf: true,
    })

    const result = latest
      ? await sendLatestStoredWeeklyReport({
          generatedBy: auth.sessionUser.displayName,
        })
      : await runWeeklyAutomaticReport({
          sendEmail: true,
          triggeredBy: "manual",
          generatedBy: auth.sessionUser.displayName,
        })

    return NextResponse.json(
      { success: result.success || result.pdfGenerated, result },
      { status: result.pdfGenerated || result.success ? 200 : 500 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo enviar el reporte."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
