import { NextResponse } from "next/server"

import {
  recordTaskMaterialLineAddedAudit,
} from "@/lib/audit/task-material-lines-audit"
import {
  recordMaterialReservationCreatedAudit,
} from "@/lib/audit/material-reservations-audit"
import {
  requireTaskMaterialLinesMutationContext,
  requireTaskMaterialLinesReadContext,
} from "@/lib/materials/task-material-lines-route-context"
import {
  createTaskMaterialLine,
  fetchTaskMaterialLines,
} from "@/lib/supabase/task-material-lines.queries"
import { fetchTaskMaterialLinesForTaskDetail } from "@/lib/supabase/task-material-consumption.queries"
import { createClient } from "@/lib/supabase/server"
import type { CreateTaskMaterialLinePayload } from "@/lib/types/supabase/task-material-lines"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireTaskMaterialLinesReadContext()
  if (!auth.ok) return auth.response

  const { taskId } = await context.params
  const scope = new URL(request.url).searchParams.get("scope")
  const client = await createClient()
  const result =
    scope === "detail"
      ? await fetchTaskMaterialLinesForTaskDetail(client, auth.companyId, taskId)
      : await fetchTaskMaterialLines(client, auth.companyId, taskId)

  if (result.error) {
    const status =
      result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code === "FORBIDDEN"
          ? 403
          : 500
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status }
    )
  }

  return NextResponse.json({ success: true, lines: result.data ?? [] })
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireTaskMaterialLinesMutationContext()
  if (!auth.ok) return auth.response

  const { taskId } = await context.params

  let payload: CreateTaskMaterialLinePayload
  try {
    payload = (await request.json()) as CreateTaskMaterialLinePayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await createTaskMaterialLine(
    client,
    auth.companyId,
    taskId,
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
            : 500
    return NextResponse.json(
      { success: false, message: result.error?.message ?? "Error desconocido." },
      { status }
    )
  }

  const { data: taskRow } = await client
    .from("tasks")
    .select("code")
    .eq("id", taskId)
    .maybeSingle()

  recordTaskMaterialLineAddedAudit({
    taskId,
    taskCode: taskRow?.code,
    line: result.data,
  })

  if (result.data.reservationAction === "created") {
    recordMaterialReservationCreatedAudit({
      taskId,
      taskCode: taskRow?.code,
      lines: [result.data],
    })
  }

  return NextResponse.json({ success: true, line: result.data })
}
