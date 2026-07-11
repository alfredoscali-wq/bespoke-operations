import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { canAccessObrasModuleForStart } from "@/lib/projects/obra-task-insert-integrity"
import { finalizeProjectOperational } from "@/lib/projects/finalize-project.server"
import { recordProjectStatusChangeAuditFromTransition } from "@/lib/audit/projects-audit"
import { createClient } from "@/lib/supabase/server"
import { fetchProjectById } from "@/lib/supabase/projects.queries"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  if (!canAccessObrasModuleForStart(auth.sessionUser)) {
    return NextResponse.json(
      {
        success: false,
        message: "No tiene permiso para operar el módulo Obras.",
      },
      { status: 403 }
    )
  }

  const companyId = auth.sessionUser.companyId
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "No se pudo resolver la compañía del usuario." },
      { status: 403 }
    )
  }

  const { projectId } = await context.params

  const client = await createClient()
  const existingResult = await fetchProjectById(client, projectId, companyId)

  if (existingResult.error || !existingResult.data) {
    return NextResponse.json(
      {
        success: false,
        message: existingResult.error?.message ?? "Obra no encontrada.",
      },
      { status: 404 }
    )
  }

  const existing = existingResult.data

  const result = await finalizeProjectOperational({
    companyId,
    projectId,
    actorDisplayName: auth.sessionUser.displayName,
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message, code: result.code },
      { status: result.status }
    )
  }

  try {
    recordProjectStatusChangeAuditFromTransition({
      project: existing,
      previousStatus: result.data.previousStatus,
      nextStatus: "closed",
    })
  } catch {
    // Audit must not block operational finalize.
  }

  return NextResponse.json({
    success: true,
    projectId: result.data.projectId,
    previousStatus: result.data.previousStatus,
    nextStatus: result.data.nextStatus,
    openTaskCount: result.data.openTaskCount,
  })
}
