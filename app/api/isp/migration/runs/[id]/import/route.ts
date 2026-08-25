import { NextResponse } from "next/server"

import {
  getIspMigrationRun,
  importIspMigrationRun,
} from "@/lib/isp/migration/queries"
import { requireIspMigrationWriteContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireIspMigrationWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let forceReimport = false
  try {
    const body = (await request.json()) as { forceReimport?: boolean }
    forceReimport = body.forceReimport === true
  } catch {
    forceReimport = false
  }

  try {
    const client = await createClient()
    const run = await getIspMigrationRun(client, auth.companyId, id)
    if (!run) {
      return NextResponse.json(
        { success: false, message: "La migración no pertenece a esta empresa." },
        { status: 404 }
      )
    }

    if (run.status === "no_real_data") {
      return NextResponse.json(
        {
          success: false,
          message: "No hay datos reales para importar.",
        },
        { status: 400 }
      )
    }

    if (
      run.errorsCount > 0 ||
      run.status === "rejected" ||
      run.status === "failed"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "No se puede confirmar mientras existan errores bloqueantes.",
        },
        { status: 400 }
      )
    }

    if (run.status === "completed" && !forceReimport) {
      return NextResponse.json(
        {
          success: false,
          needsForce: true,
          message:
            "Este archivo ya fue importado. Confirme una reimportación explícita.",
        },
        { status: 409 }
      )
    }

    if (
      run.status !== "pending_review" &&
      run.status !== "validated" &&
      !(run.status === "completed" && forceReimport)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "La migración todavía no está lista para confirmarse.",
        },
        { status: 400 }
      )
    }

    const duplicate =
      Boolean(run.summary.duplicateCompletedRun) && !forceReimport
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          needsForce: true,
          message:
            "Este archivo ya fue importado. Confirme una reimportación explícita.",
        },
        { status: 409 }
      )
    }

    const result = await importIspMigrationRun(client, id, forceReimport)
    const updated = await getIspMigrationRun(client, auth.companyId, id)
    return NextResponse.json({
      success: true,
      result,
      run: updated,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo confirmar la migración de abonados.",
      },
      { status: 400 }
    )
  }
}
