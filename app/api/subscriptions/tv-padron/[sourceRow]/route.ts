import { NextResponse } from "next/server"

import {
  ABNET_TV_PADRON_REMOVE_ACTION,
  planAbnetTvPadronRemoval,
} from "@/lib/subscriptions/abnet-tv-padron-exclusions"
import {
  loadAbnetTvPadronSourceRows,
  loadActiveAbnetTvPadronExclusions,
} from "@/lib/subscriptions/abnet-tv-padron-source"
import {
  abnetPadronCustomerNumber,
  ABNET_TV_PADRON_SOURCE,
} from "@/lib/subscriptions/abnet-tv-padron"
import { requireSubscriptionsWriteContext } from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ sourceRow: string }> }

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  const { sourceRow: rawSourceRow } = await context.params
  const sourceRow = Number(rawSourceRow)
  if (!Number.isInteger(sourceRow) || sourceRow <= 0) {
    return jsonError("La fila del padrón no es válida.", 400)
  }

  let body: { abnetCustomerNumber?: unknown; source?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Cuerpo JSON inválido.", 400)
  }

  const abnetCustomerNumber = abnetPadronCustomerNumber(body.abnetCustomerNumber)
  if (!abnetCustomerNumber) {
    return jsonError("Indique el N° Cliente de la fila.", 400)
  }
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : ABNET_TV_PADRON_SOURCE
  const createdBy = auth.sessionUser.authUserId?.trim() ?? ""
  if (!createdBy) return jsonError("Usuario no resuelto para la sesión.", 400)

  try {
    const client = await createClient()
    const [storedExclusions, storedRows] = await Promise.all([
      loadActiveAbnetTvPadronExclusions(client, auth.companyId),
      loadAbnetTvPadronSourceRows(client, auth.companyId),
    ])
    if (storedExclusions.missing) {
      return jsonError(
        "La baja del padrón de TV todavía no está disponible.",
        503
      )
    }
    if (storedExclusions.error) {
      return jsonError(storedExclusions.error.message, 400)
    }
    if (storedRows.error) return jsonError(storedRows.error.message, 400)

    const plan = planAbnetTvPadronRemoval({
      companyId: auth.companyId,
      source,
      sourceRow,
      abnetCustomerNumber,
      rows: storedRows.rows,
      exclusions: storedExclusions.exclusions,
    })
    if (plan.outcome === "not_found") {
      return jsonError(
        "La fila del padrón de TV no existe o no pertenece a esta empresa.",
        404
      )
    }
    if (plan.outcome === "already_removed") {
      return NextResponse.json({
        success: true,
        alreadyRemoved: true,
        sourceRow,
        abnetCustomerNumber,
      })
    }

    const inserted = await (
      client as unknown as {
        from: (table: string) => {
          insert: (row: Record<string, unknown>) => Promise<{
            error: { code?: string; message: string } | null
          }>
        }
      }
    )
      .from("abnet_tv_padron_exclusions")
      .insert({
        company_id: auth.companyId,
        source: plan.source,
        source_row: plan.sourceRow,
        abnet_customer_number: plan.abnetCustomerNumber,
        action: ABNET_TV_PADRON_REMOVE_ACTION,
        created_by: createdBy,
      })

    if (inserted.error?.code === "23505") {
      return NextResponse.json({
        success: true,
        alreadyRemoved: true,
        sourceRow: plan.sourceRow,
        abnetCustomerNumber: plan.abnetCustomerNumber,
      })
    }
    if (inserted.error) return jsonError(inserted.error.message, 400)

    return NextResponse.json({
      success: true,
      alreadyRemoved: false,
      sourceRow: plan.sourceRow,
      abnetCustomerNumber: plan.abnetCustomerNumber,
    })
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "No se pudo eliminar la fila del padrón de TV.",
      500
    )
  }
}
