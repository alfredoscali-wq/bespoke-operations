import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import {
  getWeeklyReportSettings,
  updateWeeklyReportSettings,
} from "@/lib/reports/automatic"

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
    const settings = await getWeeklyReportSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar la configuración."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  try {
    const body = (await request.json()) as {
      enabled?: boolean
      companyName?: string
      recipientEmail?: string
      sendDay?: number
      sendTime?: string
    }

    const settings = await updateWeeklyReportSettings({
      enabled: Boolean(body.enabled),
      companyName: body.companyName?.trim() ?? "",
      recipientEmail: body.recipientEmail?.trim() ?? "",
      sendDay: Number(body.sendDay ?? 1),
      sendTime: body.sendTime?.trim() ?? "07:30",
    })

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo guardar la configuración."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
