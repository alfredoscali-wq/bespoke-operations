import { NextResponse } from "next/server"

import { queryAuditLogs } from "@/lib/audit/audit-service"
import { AUDIT_SEVERITIES } from "@/lib/audit/types"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { createAdminClient } from "@/lib/supabase/admin"

/** @deprecated Usar GET /api/audit/events */
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
    const result = await queryAuditLogs(admin, {
      companyId: resolveTenantCompanyId(auth.sessionUser),
      severity: AUDIT_SEVERITIES.CRITICAL,
      limit: 50,
    })

    return NextResponse.json({
      success: true,
      entries: result.entries,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el Historial del Sistema."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
