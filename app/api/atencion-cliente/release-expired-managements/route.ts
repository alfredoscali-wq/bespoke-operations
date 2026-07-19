import { NextResponse } from "next/server"

import { releaseExpiredCustomerAtencionManagements } from "@/lib/customer-atenciones/consultation-management.server"
import { requireAtencionClienteMutationContext } from "@/lib/customer-atenciones/consultation-management-route"

/** RC 3.2.5 — lazy release of idle exclusive locks (callable on inbox load). */
export async function POST() {
  const auth = await requireAtencionClienteMutationContext()
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
}
