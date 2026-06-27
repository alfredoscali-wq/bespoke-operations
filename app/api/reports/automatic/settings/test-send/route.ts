import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { testWeeklyReportDelivery } from "@/lib/reports/automatic"

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
    const result = await testWeeklyReportDelivery({
      generatedBy: auth.sessionUser.displayName,
    })

    return NextResponse.json(
      { success: result.success || result.pdfGenerated, result },
      { status: result.pdfGenerated || result.success ? 200 : 500 }
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo probar el envío del reporte."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
