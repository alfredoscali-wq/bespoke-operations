import { NextResponse } from "next/server"

import { buildIspPrefillForTask, getIspWorkOrder } from "@/lib/isp/queries"
import { requireIspReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ taskId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const { taskId } = await context.params
  const url = new URL(request.url)
  const mode = url.searchParams.get("mode")

  try {
    const client = await createClient()
    if (mode === "task") {
      const taskResult = await getIspWorkOrder(client, taskId)
      if (taskResult.error || !taskResult.data) {
        return NextResponse.json(
          { success: false, message: "OT no encontrada." },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, task: taskResult.data })
    }

    const prefill = await buildIspPrefillForTask(client, auth.companyId, taskId)
    if (!prefill) {
      return NextResponse.json(
        { success: false, message: "OT no encontrada." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, prefill })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo leer la OT.",
      },
      { status: 500 }
    )
  }
}
