import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import { modifyClientPassword } from "@/lib/integrations/latam-tv/client"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { latamIdentifierFromCustomer } from "@/lib/integrations/latam-tv/identifier"
import { recordLatamPasswordChangeAudit } from "@/lib/integrations/latam-tv/password-audit"
import {
  latamPasswordsMatch,
  validateLatamTvPassword,
} from "@/lib/integrations/latam-tv/password"
import {
  requireSubscriptionsWriteContext,
  type SubscriptionsRouteContext,
} from "@/lib/subscriptions/route-context"
import type { LatamPasswordAuditResult } from "@/lib/integrations/latam-tv/password-audit"
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

function readPasswords(value: unknown): { password: string; confirmPassword: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.password !== "string" || typeof record.confirmPassword !== "string") {
    return null
  }
  if ("identificador" in record || "identifier" in record) return null
  return { password: record.password, confirmPassword: record.confirmPassword }
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
  const input = readPasswords(payload)
  if (!input) return jsonError("Solicitud inválida.", 400)
  if (!latamPasswordsMatch(input.password, input.confirmPassword)) {
    return jsonError("Las contraseñas no coinciden.", 422)
  }
  const invalid = validateLatamTvPassword(input.password)
  if (invalid) return jsonError(invalid, 422)

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_id, external_customer_code, deleted_at")
      .eq("id", customerId)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return jsonError("No se pudo preparar el cambio de contraseña.", 400)

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

    let result: Awaited<ReturnType<typeof modifyClientPassword>>
    try {
      result = await modifyClientPassword(resolved.identifier, input.password, config)
    } catch (error) {
      if (error instanceof LatamTvRequestError && error.kind === "unavailable") {
        await auditPassword(auth, customerId, resolved.identifier, "unavailable")
        return jsonError(NETWORK_MESSAGE, 502)
      }
      throw error
    }

    const auditResult =
      result.outcome === "changed"
        ? "changed"
        : result.outcome === "not_found"
          ? "not_found"
          : result.outcome === "rejected"
            ? "rejected"
            : null
    if (auditResult) {
      await auditPassword(auth, customerId, resolved.identifier, auditResult)
    }

    if (result.outcome === "changed") {
      return NextResponse.json({
        success: true,
        outcome: "changed",
        message: "Contraseña modificada correctamente en LATAM TV.",
      })
    }
    const status = result.outcome === "busy" ? 409 : 422
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
    console.error("LATAM TV password change failed")
    return jsonError(NETWORK_MESSAGE, 502)
  }
}

async function auditPassword(
  auth: SubscriptionsRouteContext,
  customerId: string,
  identifier: string,
  result: LatamPasswordAuditResult
) {
  try {
    await recordLatamPasswordChangeAudit({
      sessionUser: auth.sessionUser,
      companyId: auth.companyId,
      customerId,
      identifier,
      result,
    })
  } catch {
    console.error("No se pudo auditar el cambio de clave LATAM TV.")
  }
}
