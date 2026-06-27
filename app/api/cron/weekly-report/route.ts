import { NextResponse } from "next/server"

import { getCronSecret } from "@/lib/reports/automatic/config"
import { runWeeklyAutomaticReport } from "@/lib/reports/automatic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret()
  if (!secret) {
    return false
  }

  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = new URL(request.url).searchParams.get("secret")

  return headerSecret === secret || querySecret === secret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "No autorizado." },
      { status: 401 }
    )
  }

  try {
    const result = await runWeeklyAutomaticReport({
      sendEmail: true,
      triggeredBy: "cron",
    })

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo generar el reporte semanal."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
