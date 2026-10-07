import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import {
  disableClient,
  enableClient,
  type LatamAccountToggle,
  type LatamAccountToggleResult,
} from "@/lib/integrations/latam-tv/client"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { latamIdentifierFromCustomer } from "@/lib/integrations/latam-tv/identifier"
import {
  recordLatamClientStatusAudit,
  type LatamStatusAuditResult,
} from "@/lib/integrations/latam-tv/password-audit"
import {
  requireSubscriptionsWriteContext,
  type SubscriptionsRouteContext,
} from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ customerId: string }> }

const CUSTOMER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NETWORK_MESSAGE =
  "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

function readAction(value: unknown): LatamAccountToggle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (
    "identificador" in record ||
    "identifier" in record ||
    "id_plan" in record ||
    "password" in record
  ) {
    return null
  }
  if (record.action === "disable" || record.action === "enable") return record.action
  return null
}

function successMessage(action: LatamAccountToggle, status: "enabled" | "disabled"): string | null {
  if (action === "disable" && status === "disabled") {
    return "Cliente suspendido correctamente en LATAM TV."
  }
  if (action === "enable" && status === "enabled") {
    return "Cliente activado correctamente en LATAM TV."
  }
  return null
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  const { customerId } = await context.params
  if (!CUSTOMER_ID.test(customerId)) {
    return jsonError("Cliente no encontrado.", 404)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonError("Solicitud inválida.", 400)
  }
  const action = readAction(payload)
  if (!action) return jsonError("Solicitud inválida.", 400)

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_id, external_customer_code, deleted_at")
      .eq("id", customerId)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return jsonError("No se pudo preparar el cambio de estado.", 400)

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
    if (resolved.status !== "ready") {
      return jsonError("El cliente no tiene N° ABNet.", 422)
    }

    const config = readLatamTvConfig()
    if (!config) {
      console.error("LATAM TV no está configurado (LATAM_TV_API_URL / LATAM_TV_API_TOKEN).")
      throw new LatamTvRequestError("not_configured")
    }

    const run = action === "disable" ? disableClient : enableClient
    let result: LatamAccountToggleResult
    try {
      result = await run(resolved.identifier, config)
    } catch (error) {
      if (error instanceof LatamTvRequestError && error.kind === "unavailable") {
        await auditStatus(auth, customerId, resolved.identifier, action, "unavailable")
        return jsonError(NETWORK_MESSAGE, 502)
      }
      throw error
    }

    const auditResult = auditOutcome(result)
    if (auditResult) {
      await auditStatus(auth, customerId, resolved.identifier, action, auditResult)
    }

    if (result.outcome === "updated") {
      return NextResponse.json({
        success: true,
        outcome: "updated",
        status: result.status,
        message: successMessage(action, result.status),
      })
    }
    if (result.outcome === "mismatch") {
      return NextResponse.json(
        {
          success: false,
          outcome: "mismatch",
          status: result.status,
          message: result.message,
        },
        { status: 409 }
      )
    }
    const status = result.outcome === "busy" ? 409 : result.outcome === "unavailable" ? 502 : 422
    return NextResponse.json(
      { success: false, outcome: result.outcome, message: result.message },
      { status }
    )
  } catch (error) {
    if (error instanceof LatamTvRequestError) {
      if (error.kind === "not_configured") return jsonError(error.message, 503)
      if (error.kind === "invalid_identifier") return jsonError(error.message, 422)
      return jsonError(NETWORK_MESSAGE, 502)
    }
    console.error("LATAM TV status change failed")
    return jsonError(NETWORK_MESSAGE, 502)
  }
}

function auditOutcome(result: LatamAccountToggleResult): LatamStatusAuditResult | null {
  if (result.outcome === "updated") return "updated"
  if (result.outcome === "not_found") return "not_found"
  if (result.outcome === "rejected") return "rejected"
  if (result.outcome === "unavailable") return "unavailable"
  if (result.outcome === "mismatch") return "mismatch"
  return null
}

async function auditStatus(
  auth: SubscriptionsRouteContext,
  customerId: string,
  identifier: string,
  action: LatamAccountToggle,
  result: LatamStatusAuditResult
) {
  try {
    await recordLatamClientStatusAudit({
      sessionUser: auth.sessionUser,
      companyId: auth.companyId,
      customerId,
      identifier,
      operation: action === "disable" ? "disable_client" : "enable_client",
      result,
    })
  } catch {
    console.error("No se pudo auditar el cambio de estado LATAM TV.")
  }
}
