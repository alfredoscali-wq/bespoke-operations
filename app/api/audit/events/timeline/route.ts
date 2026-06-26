import { NextResponse } from "next/server"

import { queryAuditEntityTimeline } from "@/lib/audit/audit-service"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get("entityType")
  const entityId = searchParams.get("entityId")

  if (!entityType?.trim() || !entityId?.trim()) {
    return NextResponse.json(
      {
        success: false,
        message: "entityType y entityId son obligatorios.",
      },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const entries = await queryAuditEntityTimeline(admin, {
      entityType,
      entityId,
    })

    return NextResponse.json({ success: true, entries })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar la línea de tiempo."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
