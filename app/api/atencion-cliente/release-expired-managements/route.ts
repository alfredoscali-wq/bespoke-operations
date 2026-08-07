import { NextResponse } from "next/server"

import { releaseExpiredCustomerAtencionManagements } from "@/lib/customer-atenciones/consultation-management.server"
import { requireReleaseExpiredAuthContext } from "@/lib/customer-atenciones/release-expired-auth.server"
import { runWithReleaseExpiredPerf } from "@/lib/customer-service/performance/release-expired-breakdown"

/** RC 3.2.5 — lazy release of idle exclusive locks (callable on inbox load). */
export async function POST() {
  return runWithReleaseExpiredPerf(async () => {
    // Sprint 32.0 — JWT metadata context (skips SessionUser + DB role lookups).
    const auth = await requireReleaseExpiredAuthContext()
    if (!auth.ok) {
      return auth.response
    }

    const result = await releaseExpiredCustomerAtencionManagements({
      companyId: auth.companyId,
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, code: result.code },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      releasedCount: result.releasedCount,
      timeoutMinutes: result.timeoutMinutes,
    })
  })
}
