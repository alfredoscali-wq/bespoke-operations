import { NextResponse } from "next/server"

import {
  recordTaskMaterialLineDeletedAudit,
  recordTaskMaterialLineUpdatedAudit,
} from "@/lib/audit/task-material-lines-audit"
import {
  recordMaterialReservationCreatedAudit,
  recordMaterialReservationReleasedAudit,
  recordMaterialReservationUpdatedAudit,
} from "@/lib/audit/material-reservations-audit"
import { requireTaskMaterialLinesMutationContext } from "@/lib/materials/task-material-lines-route-context"
import {
  deleteTaskMaterialLine,
  fetchTaskMaterialLines,
  updateTaskMaterialLine,
} from "@/lib/supabase/task-material-lines.queries"
import { createClient } from "@/lib/supabase/server"
import type { UpdateTaskMaterialLinePayload } from "@/lib/types/supabase/task-material-lines"

type RouteContext = {
  params: Promise<{ taskId: string; lineId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireTaskMaterialLinesMutationContext()
  if (!auth.ok) return auth.response

  const { taskId, lineId } = await context.params

  let payload: UpdateTaskMaterialLinePayload
  try {
    payload = (await request.json()) as UpdateTaskMaterialLinePayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()

  const beforeResult = await fetchTaskMaterialLines(client, auth.companyId, taskId)
  const beforeLine = beforeResult.data?.find((line) => line.id === lineId)

  const result = await updateTaskMaterialLine(
    client,
    auth.companyId,
    taskId,
    lineId,
    payload
  )

  if (result.error || !result.data) {
    const status =
      result.error?.code === "VALIDATION"
        ? 400
        : result.error?.code === "NOT_FOUND"
          ? 404
          : result.error?.code === "FORBIDDEN"
            ? 403
            : result.error?.code === "CONFLICT"
              ? 409
              : 500
    return NextResponse.json(
      { success: false, message: result.error?.message ?? "Error desconocido." },
      { status }
    )
  }

  if (beforeLine) {
    const { data: taskRow } = await client
      .from("tasks")
      .select("code")
      .eq("id", taskId)
      .maybeSingle()

    recordTaskMaterialLineUpdatedAudit({
      taskId,
      taskCode: taskRow?.code,
      before: beforeLine,
      after: result.data,
    })

    if (result.data.reservationAction === "created") {
      recordMaterialReservationCreatedAudit({
        taskId,
        taskCode: taskRow?.code,
        lines: [result.data],
      })
    } else if (result.data.reservationAction === "updated") {
      recordMaterialReservationUpdatedAudit({
        taskId,
        taskCode: taskRow?.code,
        line: result.data,
        delta: result.data.quantityPlanned - beforeLine.quantityPlanned,
      })
    } else if (result.data.reservationAction === "released") {
      recordMaterialReservationReleasedAudit({
        taskId,
        taskCode: taskRow?.code,
        line: beforeLine,
      })
    }
  }

  return NextResponse.json({ success: true, line: result.data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireTaskMaterialLinesMutationContext()
  if (!auth.ok) return auth.response

  const { taskId, lineId } = await context.params
  const client = await createClient()

  const beforeResult = await fetchTaskMaterialLines(client, auth.companyId, taskId)
  const beforeLine = beforeResult.data?.find((line) => line.id === lineId)

  const result = await deleteTaskMaterialLine(
    client,
    auth.companyId,
    taskId,
    lineId
  )

  if (result.error) {
    const status =
      result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code === "FORBIDDEN"
          ? 403
          : result.error.code === "CONFLICT"
            ? 409
            : 500
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status }
    )
  }

  if (beforeLine) {
    const { data: taskRow } = await client
      .from("tasks")
      .select("code")
      .eq("id", taskId)
      .maybeSingle()

    recordTaskMaterialLineDeletedAudit({
      taskId,
      taskCode: taskRow?.code,
      line: beforeLine,
    })

    if (result.data?.reservationAction === "released") {
      recordMaterialReservationReleasedAudit({
        taskId,
        taskCode: taskRow?.code,
        line: beforeLine,
      })
    }
  }

  return NextResponse.json({ success: true })
}
