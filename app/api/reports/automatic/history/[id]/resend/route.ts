import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { resendStoredWeeklyReport } from "@/lib/reports/automatic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  try {
    const { id } = await context.params
    const result = await resendStoredWeeklyReport({
      historyId: id,
      generatedBy: auth.sessionUser.displayName,
    })

    return NextResponse.json(
      { success: result.success || result.pdfGenerated, result },
      { status: result.pdfGenerated || result.success ? 200 : 500 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo reenviar el reporte."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
