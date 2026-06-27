import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { runWeeklyAutomaticReport } from "@/lib/reports/automatic"

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
    const result = await runWeeklyAutomaticReport({
      sendEmail: true,
      includePdfBase64: true,
      includeSignedUrl: true,
      triggeredBy: "manual",
      generatedBy: auth.sessionUser.displayName,
      skipEnabledCheck: true,
    })

    return NextResponse.json(
      { success: result.success || result.pdfGenerated, result },
      { status: result.pdfGenerated || result.success ? 200 : 500 }
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo generar el reporte semanal."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
