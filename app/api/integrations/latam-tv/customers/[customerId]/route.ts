import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import { listLatamTvClients } from "@/lib/integrations/latam-tv/client"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { resolveLatamIdentity } from "@/lib/integrations/latam-tv/identity"
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
      .select("id, company_id, dni, email, deleted_at")
      .eq("id", customerId)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return jsonError("No se pudo consultar LATAM TV.", 400)
    if (!data || data.company_id !== auth.companyId || data.deleted_at) {
      return jsonError("Cliente no encontrado.", 404)
    }

    const config = readLatamTvConfig()
    if (!config) {
      console.error(
        "LATAM TV no está configurado (LATAM_TV_API_URL / LATAM_TV_API_TOKEN)."
      )
      throw new LatamTvRequestError("not_configured")
    }

    const nationalId = data.dni?.replace(/\D/g, "") || null
    const email = data.email?.trim() || null
    if (!nationalId && !email?.includes("@")) {
      return NextResponse.json({
        success: true,
        outcome: "not_found",
        reason: "missing_identity",
      })
    }

    const catalog = await listLatamTvClients({ ...config, timeoutMs: 20_000 })
    const identity = resolveLatamIdentity(catalog, {
      nationalId,
      email,
      linkedIdentifier: null,
    })
    console.info("LATAM TV identity outcome=%s", identity.outcome)
    return NextResponse.json({ success: true, ...identity })
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
