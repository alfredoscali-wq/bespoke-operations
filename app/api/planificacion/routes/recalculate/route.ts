import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { recalculateCrewJourneyTravel } from "@/lib/engines/planning/services/recalculate-crew-journey"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapCrewRowToCrew } from "@/lib/supabase/crews.mapper"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { CrewRow } from "@/lib/supabase/database.types"
import type { Json, TaskRow } from "@/lib/supabase/database.types"

type Body = {
  crewId?: string
  taskIds?: string[]
}

export async function POST(request: Request) {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const crewId = body.crewId?.trim()
  const taskIds = Array.isArray(body.taskIds)
    ? body.taskIds.filter((id) => typeof id === "string" && id.trim())
    : []

  if (!crewId) {
    return NextResponse.json(
      { success: false, message: "crewId es obligatorio." },
      { status: 400 }
    )
  }

  if (taskIds.length === 0) {
    return NextResponse.json({
      success: true,
      recalculatedCount: 0,
      skippedManualCount: 0,
      failedCount: 0,
      updatedTaskIds: [],
    })
  }

  const admin = createAdminClient()
  const companyId = auth.sessionUser.companyId?.trim()
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "Sesión sin empresa." },
      { status: 403 }
    )
  }

  const { data: crewRow, error: crewError } = await admin
    .from("crews")
    .select("*")
    .eq("id", crewId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (crewError || !crewRow) {
    return NextResponse.json(
      { success: false, message: "Cuadrilla no encontrada." },
      { status: 404 }
    )
  }

  const { data: taskRows, error: tasksError } = await admin
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .in("id", taskIds)
    .is("deleted_at", null)

  if (tasksError) {
    return NextResponse.json(
      { success: false, message: "No se pudieron cargar las OT." },
      { status: 500 }
    )
  }

  const crew = mapCrewRowToCrew(crewRow as CrewRow)
  const tasks = (taskRows ?? []).map((row) =>
    mapTaskRowToTask(row as TaskRow)
  )

  const result = await recalculateCrewJourneyTravel({
    tasks,
    crew,
    crews: [{ id: crew.id, name: crew.name }],
  })

  if (!result.ok) {
    // Soft failure — planning continues; supervisor can edit manually.
    console.warn("[planning/route] recalc_aborted", { message: result.message })
    return NextResponse.json({
      success: true,
      warning: result.message,
      recalculatedCount: 0,
      skippedManualCount: 0,
      failedCount: 0,
      updatedTaskIds: [],
    })
  }

  const updatedTaskIds: string[] = []

  for (const update of result.updates) {
    const { error } = await admin
      .from("tasks")
      .update({
        task_metadata: update.taskMetadata as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", update.taskId)
      .eq("company_id", companyId)

    if (error) {
      console.warn("[planning/route] persist_failed", {
        taskId: update.taskId,
        error: error.message,
      })
      continue
    }
    updatedTaskIds.push(update.taskId)
  }

  return NextResponse.json({
    success: true,
    recalculatedCount: result.recalculatedCount,
    skippedManualCount: result.skippedManualCount,
    failedCount: result.failedCount,
    updatedTaskIds,
  })
}
