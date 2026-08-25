import { NextResponse } from "next/server"

import { validateIspMigration } from "@/lib/isp/migration/integrity"
import {
  getIspMigrationRun,
  listIspMigrationStagingRows,
  loadIspMigrationExistingState,
  updateIspMigrationRunValidation,
} from "@/lib/isp/migration/queries"
import {
  applyReviewPatches,
  buildMigrationReviewItems,
  filterReviewItems,
  storedRowsToParsedWorkbook,
  type IspMigrationReviewItem,
} from "@/lib/isp/migration/review"
import {
  requireIspMigrationReadContext,
  requireIspMigrationWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

function canReviewRun(status: string) {
  return (
    status === "pending_review" ||
    status === "validated" ||
    status === "rejected"
  )
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireIspMigrationReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const filterParam = new URL(request.url).searchParams.get("filter") ?? "all"
  const filter =
    filterParam === "valid" ||
    filterParam === "warning" ||
    filterParam === "error"
      ? filterParam
      : "all"

  try {
    const client = await createClient()
    const run = await getIspMigrationRun(client, auth.companyId, id)
    if (!run) {
      return NextResponse.json(
        { success: false, message: "La migración no pertenece a esta empresa." },
        { status: 404 }
      )
    }

    const rows = await listIspMigrationStagingRows(client, auth.companyId, id)
    const allItems = buildMigrationReviewItems(rows)
    const items = filterReviewItems(allItems, filter)
    return NextResponse.json({
      success: true,
      run,
      items,
      totals: {
        all: allItems.length,
        valid: allItems.filter((item) => item.status === "valid").length,
        warning: allItems.filter((item) => item.status === "warning").length,
        error: allItems.filter((item) => item.status === "error").length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la revisión.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireIspMigrationWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: {
    customerRowId?: string | null
    serviceRowId?: string | null
    connectionRowId?: string | null
    fields?: Record<string, string>
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { success: false, message: "Solicitud inválida." },
      { status: 400 }
    )
  }

  const fields = body.fields ?? {}
  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { success: false, message: "Indique al menos un campo a corregir." },
      { status: 400 }
    )
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
    if (!canReviewRun(run.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Esta migración ya no admite correcciones en pantalla.",
        },
        { status: 400 }
      )
    }

    const rows = await listIspMigrationStagingRows(client, auth.companyId, id)
    const patched = applyReviewPatches(rows, {
      customerRowId: body.customerRowId ?? null,
      serviceRowId: body.serviceRowId ?? null,
      connectionRowId: body.connectionRowId ?? null,
      fields,
    })
    const parsed = storedRowsToParsedWorkbook(patched)
    const existing = await loadIspMigrationExistingState(client, auth.companyId)
    const validation = validateIspMigration(parsed, existing, {
      fileSha256: run.fileSha256 ?? undefined,
    })
    const updated = await updateIspMigrationRunValidation(client, {
      companyId: auth.companyId,
      runId: id,
      validation,
    })
    const nextRows = await listIspMigrationStagingRows(client, auth.companyId, id)
    const items: IspMigrationReviewItem[] = buildMigrationReviewItems(nextRows)

    return NextResponse.json({
      success: true,
      run: updated,
      items,
      counts: validation.counts,
      preview: validation.preview,
      canImport: validation.canImport,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la corrección.",
      },
      { status: 400 }
    )
  }
}
