import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import {
  createWeeklyReportSignedUrl,
  getAutomaticReportHistoryEntry,
} from "@/lib/reports/automatic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  try {
    const { id } = await context.params
    const entry = await getAutomaticReportHistoryEntry(id)

    if (!entry?.pdfStoragePath) {
      return NextResponse.json(
        { success: false, message: "No hay PDF almacenado para este registro." },
        { status: 404 }
      )
    }

    const signedUrl = await createWeeklyReportSignedUrl(entry.pdfStoragePath)

    return NextResponse.json({
      success: true,
      signedUrl,
      fileName: entry.pdfFileName,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo abrir el PDF."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
