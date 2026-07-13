import { NextResponse } from "next/server"

import {
  requireAtencionClienteMutationContext,
  type AtencionClienteRouteContext,
} from "@/lib/customer-atenciones/consultation-management-route"
import { linkCustomerAtencionToTask } from "@/lib/customer-atenciones/consultation-management.server"
import type { OtLinkServerResult } from "@/lib/customer-atenciones/consultation-management.server"

function otLinkResultToResponse(result: OtLinkServerResult) {
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
    linkedTaskId: result.data.linkedTaskId,
    linkedTaskCode: result.data.linkedTaskCode,
    otLinkedAt: result.data.otLinkedAt,
    otLinkedByEmployeeId: result.data.otLinkedByEmployeeId,
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
    | { taskId?: string }
    | null

  const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : ""
  if (!taskId) {
    return otLinkResultToResponse({
      ok: false,
      status: 400,
      message: "Indicá el ID de la OT a vincular.",
      code: "CONSULTATION_INVALID_PARAMETERS",
    })
  }

  const { atencionId } = await context.params

  const result = await linkCustomerAtencionToTask({
    companyId: auth.companyId,
    atencionId,
    employeeId: auth.employeeId,
    taskId,
  })

  return otLinkResultToResponse(result)
}
