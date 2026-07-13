import { NextResponse } from "next/server"

import { validateMorosoTrackingStatus } from "@/lib/customer-atenciones/moroso-flow"
import {
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import { updateCustomerAtencionMorosoTracking } from "@/lib/customer-atenciones/consultation-management.server"
import type { MorosoTrackingServerResult } from "@/lib/customer-atenciones/consultation-management.server"

function morosoTrackingResultToResponse(result: MorosoTrackingServerResult) {
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
    previousTrackingStatus: result.data.previousTrackingStatus,
    newTrackingStatus: result.data.newTrackingStatus,
  })
}

export async function POST(
  request: Request,
  context: AtencionClienteRouteContext
) {
  const auth = await requireAtencionClienteMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const body = (await request.json().catch(() => null)) as
    | { trackingStatus?: string }
    | null

  const trackingStatusResult = validateMorosoTrackingStatus(body?.trackingStatus)
  if (typeof trackingStatusResult !== "string") {
    return morosoTrackingResultToResponse({
      ok: false,
      status: 400,
      message: trackingStatusResult.error,
      code: "MOROSO_TRACKING_STATUS_INVALID",
    })
  }

  const { atencionId } = await context.params

  const result = await updateCustomerAtencionMorosoTracking({
    companyId: auth.companyId,
    atencionId,
    employeeId: auth.employeeId,
    trackingStatus: trackingStatusResult,
  })

  return morosoTrackingResultToResponse(result)
}
