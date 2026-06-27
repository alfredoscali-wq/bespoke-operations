import { NextResponse } from "next/server"

import { queryAuditLogStats } from "@/lib/audit/audit-service"
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
    const stats = await queryAuditLogStats(admin, {
      companyId: resolveTenantCompanyId(auth.sessionUser),
    })

    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron calcular los indicadores del historial."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
