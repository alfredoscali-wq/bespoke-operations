import { NextResponse } from "next/server"

import {
  recordMaterialConsumptionCreatedAudit,
  recordMaterialReturnCreatedAudit,
} from "@/lib/audit/material-consumption-audit"
import {
  requireTaskMaterialLinesMutationContext,
  requireTaskMaterialLinesReadContext,
} from "@/lib/materials/task-material-lines-route-context"
import type { ConsumptionLineInput } from "@/lib/materials/task-material-consumption"
import {
  confirmTaskMaterialConsumption,
  fetchReservedTaskMaterialLines,
} from "@/lib/supabase/task-material-consumption.queries"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTaskMaterialLinesReadContext()
  if (!auth.ok) return auth.response

  const { taskId } = await context.params
  const client = await createClient()
  const result = await fetchReservedTaskMaterialLines(
    client,
    auth.companyId,
    taskId
  )

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

  let body: { useAll?: boolean; lines?: ConsumptionLineInput[] }
  try {
    body = (await request.json()) as { useAll?: boolean; lines?: ConsumptionLineInput[] }
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()

  const beforeResult = await fetchReservedTaskMaterialLines(
    client,
    auth.companyId,
    taskId
  )

  const result = await confirmTaskMaterialConsumption(client, taskId, {
    useAll: Boolean(body.useAll),
    lines: body.lines,
  })

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

  if (!result.data.skipped && beforeResult.data) {
    const { data: taskRow } = await client
      .from("tasks")
      .select("code")
      .eq("id", taskId)
      .maybeSingle()

    for (const processed of result.data.lines) {
      const line = beforeResult.data.find((item) => item.id === processed.lineId)
      if (!line) continue

      if (processed.quantityConsumed > 0) {
        recordMaterialConsumptionCreatedAudit({
          taskId,
          taskCode: taskRow?.code,
          line,
          quantity: processed.quantityConsumed,
        })
      }

      if (processed.quantityReturned > 0) {
        recordMaterialReturnCreatedAudit({
          taskId,
          taskCode: taskRow?.code,
          line,
          quantity: processed.quantityReturned,
        })
      }
    }
  }

  return NextResponse.json({ success: true, result: result.data })
}
