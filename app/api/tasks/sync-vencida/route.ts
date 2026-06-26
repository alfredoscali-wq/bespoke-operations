import { NextResponse } from "next/server"

import { syncVencidaTasksWithAudit } from "@/lib/supabase/tasks-vencida-sync.server"
import { fetchTasks } from "@/lib/supabase/tasks.queries"
import { getSessionUser } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { shouldAutoTransitionToVencida } from "@/lib/tasks/vencida-status"

type SyncVencidaBody = {
  taskIds?: string[]
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  let body: SyncVencidaBody

  try {
    body = (await request.json()) as SyncVencidaBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const taskIds = Array.isArray(body.taskIds)
    ? body.taskIds.filter((value): value is string => typeof value === "string")
    : []

  if (taskIds.length === 0) {
    return NextResponse.json({
      success: true,
      updatedTaskIds: [],
    })
  }

  try {
    const admin = createAdminClient()
    const tasksResult = await fetchTasks(admin)

    if (tasksResult.error || !tasksResult.data) {
      return NextResponse.json(
        {
          success: false,
          message:
            tasksResult.error?.message ??
            "No se pudieron leer las órdenes de trabajo.",
        },
        { status: 500 }
      )
    }

    const requestedIds = new Set(taskIds)
    const tasksToSync = tasksResult.data.filter(
      (task) => requestedIds.has(task.id) && shouldAutoTransitionToVencida(task)
    )

    const { updatedTaskIds } = await syncVencidaTasksWithAudit(admin, tasksToSync)

    return NextResponse.json({
      success: true,
      updatedTaskIds,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo sincronizar el estado Vencida."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
