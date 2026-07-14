import { hardDeleteCustomerAtencionConsultation } from "@/lib/customer-atenciones/consultation-management.server"
import {
  requireAtencionClienteAdminMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  context: AtencionClienteRouteContext
) {
  const auth = await requireAtencionClienteAdminMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const { atencionId } = await context.params

  const result = await hardDeleteCustomerAtencionConsultation({
    companyId: auth.companyId,
    atencionId,
    employeeId: auth.employeeId,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        code: result.code,
      },
      { status: result.status }
    )
  }

  return NextResponse.json({
    success: true,
    atencionId: result.data.atencionId,
    deletedEvents: result.data.deletedEvents,
    clearedSeguimientos: result.data.clearedSeguimientos,
  })
}
