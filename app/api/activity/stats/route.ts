import { NextResponse } from "next/server"

import { queryActivityViewerStats } from "@/lib/activity/activity-viewer.server"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  try {
    const admin = createAdminClient()
    const stats = await queryActivityViewerStats(
      admin,
      resolveTenantCompanyId(auth.sessionUser)
    )

    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron calcular los indicadores de Activity Engine."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
