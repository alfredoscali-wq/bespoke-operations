import { NextResponse } from "next/server"

import { requireTaskMaterialLinesReadContext } from "@/lib/materials/task-material-lines-route-context"
import { fetchTaskMaterialLinesForTasks } from "@/lib/supabase/task-material-lines.queries"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const auth = await requireTaskMaterialLinesReadContext()
  if (!auth.ok) return auth.response

  let body: { taskIds?: unknown }
  try {
    body = (await request.json()) as { taskIds?: unknown }
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const taskIds = Array.isArray(body.taskIds)
    ? body.taskIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    : []

  if (taskIds.length === 0) {
    return NextResponse.json({ success: true, linesByTaskId: {} })
  }

  const client = await createClient()
  const result = await fetchTaskMaterialLinesForTasks(
    client,
    auth.companyId,
    taskIds
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    linesByTaskId: result.data ?? {},
  })
}
