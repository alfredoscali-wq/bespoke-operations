import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import { getLatamTvClientByIdentifier } from "@/lib/integrations/latam-tv/client"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { latamIdentifierFromCustomer } from "@/lib/integrations/latam-tv/identifier"
import { requireSubscriptionsReadContext } from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ customerId: string }> }

const CUSTOMER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsReadContext()
  if (!auth.ok) return auth.response

  const { customerId } = await context.params
  if (!CUSTOMER_ID.test(customerId)) {
    return jsonError("Cliente no encontrado.", 404)
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_id, external_customer_code, deleted_at")
      .eq("id", customerId)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return jsonError("No se pudo consultar LATAM TV.", 400)

    const resolved = latamIdentifierFromCustomer(
      data
        ? {
            companyId: data.company_id,
            externalCustomerCode: data.external_customer_code,
            deletedAt: data.deleted_at,
          }
        : null,
      auth.companyId
    )
    if (resolved.status === "not_found") {
      return jsonError("Cliente no encontrado.", 404)
    }
    if (resolved.status === "missing_identifier") {
      return jsonError(
        "El cliente no tiene N° ABNet para consultar en LATAM TV.",
        422
      )
    }

    const config = readLatamTvConfig()
    if (!config) {
      console.error(
        "LATAM TV no está configurado (LATAM_TV_API_URL / LATAM_TV_API_TOKEN)."
      )
      throw new LatamTvRequestError("not_configured")
    }

    const lookup = await getLatamTvClientByIdentifier(resolved.identifier, config)
    console.info(
      "LATAM TV lookup method=GET path=/api/get-clients identificador=%s result=%s",
      resolved.identifier,
      lookup.found ? (lookup.client.status ?? "unreadable") : "not_registered"
    )
    return NextResponse.json({ success: true, ...lookup })
  } catch (error) {
    if (error instanceof LatamTvRequestError) {
      if (error.kind === "not_configured") {
        return jsonError(error.message, 503)
      }
      if (error.kind === "invalid_identifier") {
        return jsonError(error.message, 422)
      }
      return jsonError(error.message, 502)
    }
    console.error("LATAM TV lookup failed")
    return jsonError("No se pudo consultar LATAM TV.", 502)
  }
}
