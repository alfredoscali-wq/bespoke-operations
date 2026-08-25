import { NextResponse } from "next/server"

import { maskMigrationIssues } from "@/lib/isp/migration/mask"
import { getIspMigrationRun } from "@/lib/isp/migration/queries"
import { requireIspMigrationReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspMigrationReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    const run = await getIspMigrationRun(client, auth.companyId, id)
    if (!run) {
      return NextResponse.json(
        { success: false, message: "La migración no pertenece a esta empresa." },
        { status: 404 }
      )
    }

    const summary = run.summary as { issues?: unknown }
    const issues = Array.isArray(summary.issues)
      ? maskMigrationIssues(summary.issues as never)
      : []

    return NextResponse.json({ success: true, run, issues })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la migración.",
      },
      { status: 500 }
    )
  }
}
