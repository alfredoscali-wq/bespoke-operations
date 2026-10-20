import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import { linkExistingLatamTvClient, listLatamTvClients } from "@/lib/integrations/latam-tv/client"
import {
  associateConfirmedAbnetCustomer,
  LATAM_LINK_PARTIAL_MESSAGE,
} from "@/lib/subscriptions/bespoke-abnet-association"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { latamIdentifierFromCustomer } from "@/lib/integrations/latam-tv/identifier"
import {
  readPadronLinkCustomers,
  resolvePadronLinkIdentities,
} from "@/lib/subscriptions/padron-latam-link"
import { loadAbnetTvPadronSourceRows } from "@/lib/subscriptions/abnet-tv-padron-source"
import { requireSubscriptionsWriteContext } from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ customerId: string }> }

const CUSTOMER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  const { customerId } = await context.params
  if (!CUSTOMER_ID.test(customerId)) return jsonError("Cliente no encontrado.", 404)

  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null
  if (body?.confirm !== true) {
    return jsonError("Confirmá la vinculación antes de escribir en LATAM TV.", 400)
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_id, name, dni, email, external_customer_code, deleted_at")
      .eq("id", customerId)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return jsonError("No se pudo vincular con LATAM TV.", 400)
    if (!data || data.company_id !== auth.companyId || data.deleted_at) {
      return jsonError("Cliente no encontrado.", 404)
    }

    const identified = latamIdentifierFromCustomer(
      {
        companyId: data.company_id,
        deletedAt: data.deleted_at,
        externalCustomerCode: data.external_customer_code,
      },
      auth.companyId
    )
    let abnetNumber = identified.status === "ready" ? identified.identifier : null
    if (!abnetNumber) {
      const [padron, customers] = await Promise.all([
        loadAbnetTvPadronSourceRows(supabase, auth.companyId),
        readPadronLinkCustomers(supabase, auth.companyId),
      ])
      const matches =
        padron.error || !customers
          ? []
          : [...resolvePadronLinkIdentities({
              rows: padron.rows.map((row) => ({
                abnetNumber: row.abnetCustomerNumber,
                customerName: row.customerName,
              })),
              customers,
            }).entries()].flatMap(([number, identity]) =>
              identity.status === "ready" && identity.customerId === customerId ? [number] : []
            )
      if (matches.length !== 1) {
        return NextResponse.json({
          success: true,
          outcome: "review",
          reason: matches.length === 0 ? "missing_identity" : "ambiguous",
          message: "No se puede vincular con seguridad. No se modificó nada.",
        })
      }
      abnetNumber = matches[0]
    }

    const config = readLatamTvConfig()
    if (!config) throw new LatamTvRequestError("not_configured")

    const result = await linkExistingLatamTvClient(
      {
        customerId,
        abnetNumber,
        nationalId: data.dni,
        email: data.email,
      },
      { ...config, timeoutMs: 20_000 }
    )
    if (result.outcome === "linked") {
      let catalog
      try {
        catalog = await listLatamTvClients({ ...config, timeoutMs: 20_000 })
      } catch {
        return NextResponse.json({
          success: false,
          outcome: "partial",
          identifier: result.crmId,
          iptvId: result.iptvId,
          reason: "update_failed",
          message: LATAM_LINK_PARTIAL_MESSAGE,
        })
      }
      const associated = await associateConfirmedAbnetCustomer(supabase, {
        companyId: auth.companyId,
        customerId,
        abnetNumber,
        iptvId: result.iptvId,
        crmId: result.crmId,
        catalog,
      })
      if (associated.outcome === "saved" || associated.outcome === "already_saved") {
        return NextResponse.json({
          success: true,
          outcome: "linked",
          identifier: result.crmId,
          iptvId: result.iptvId,
          externalCustomerCode: associated.externalCustomerCode,
          message: "Cliente vinculado con LATAM TV y asociado a su ficha de Bespoke.",
        })
      }
      return NextResponse.json({
        success: false,
        outcome: "partial",
        identifier: result.crmId,
        iptvId: result.iptvId,
        reason: associated.reason,
        message: LATAM_LINK_PARTIAL_MESSAGE,
      })
    }
    if (result.outcome === "signup") {
      return NextResponse.json({
        success: true,
        outcome: "signup",
        message: "No hay una ficha existente de LATAM para vincular.",
      })
    }
    if (result.outcome === "busy") {
      return jsonError("Ya hay una vinculación en curso para este cliente.", 409)
    }
    if (result.outcome === "sync_failed") {
      return jsonError("LATAM no confirmó la vinculación. No se reintentó.", 502)
    }
    if (result.outcome === "verification_failed") {
      return jsonError("La vinculación no quedó confirmada. No se reintentó.", 502)
    }
    return NextResponse.json({
      success: true,
      outcome: "review",
      reason: result.reason,
      message: "No se puede vincular con seguridad. No se modificó nada.",
    })
  } catch (error) {
    if (error instanceof LatamTvRequestError && error.kind === "not_configured") {
      return jsonError(error.message, 503)
    }
    return jsonError("No se pudo vincular con LATAM TV.", 502)
  }
}
