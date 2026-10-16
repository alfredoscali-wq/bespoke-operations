import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import {
  changeLatamClientPlan,
  findConfirmedLatamIdentifier,
  previewLatamPlanChange,
  type LatamPlanChangeKind,
  type LatamPlanChangeResult,
} from "@/lib/integrations/latam-tv/client"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { latamIdentifierFromCustomer } from "@/lib/integrations/latam-tv/identifier"
import {
  recordLatamPlanChangeAudit,
  type LatamPlanAuditResult,
} from "@/lib/integrations/latam-tv/password-audit"
import {
  requireSubscriptionsWriteContext,
  type SubscriptionsRouteContext,
} from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"
import { loadTvPlanCommercialServices } from "@/lib/subscriptions/tv-plan-coordination-read"
import { presentTvPlanPreview } from "@/lib/subscriptions/tv-plan-coordination"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ customerId: string }> }

const CUSTOMER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NETWORK_MESSAGE =
  "No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke."

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

function isKind(value: unknown): value is LatamPlanChangeKind {
  return value === "basica" || value === "pack" || value === "full"
}

function readRequest(value: unknown): { preview: true } | { kind: LatamPlanChangeKind } | null {
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
  if (record.preview === true && !("tvKind" in record)) return { preview: true }
  if (isKind(record.tvKind) && record.preview !== true) return { kind: record.tvKind }
  return null
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  const { customerId } = await context.params
  if (!CUSTOMER_ID.test(customerId)) return jsonError("Cliente no encontrado.", 404)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonError("Solicitud inválida.", 400)
  }
  const input = readRequest(payload)
  if (!input) return jsonError("Solicitud inválida.", 400)

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_id, external_customer_code, dni, email, deleted_at")
      .eq("id", customerId)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return jsonError("No se pudo preparar el cambio de plan.", 400)

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
    if (resolved.status === "not_found") return jsonError("Cliente no encontrado.", 404)

    const config = readLatamTvConfig()
    if (!config) {
      console.error("LATAM TV no está configurado (LATAM_TV_API_URL / LATAM_TV_API_TOKEN).")
      throw new LatamTvRequestError("not_configured")
    }
    const operationId =
      resolved.status === "ready"
        ? resolved.identifier
        : await findConfirmedLatamIdentifier(
            { dni: data?.dni ?? "", email: data?.email ?? "" },
            config
          )
    if (!operationId) {
      return jsonError(
        "LATAM todavía no informó el identificador operativo. La acción sigue deshabilitada.",
        409
      )
    }

    if ("preview" in input) {
      const preview = await previewLatamPlanChange(operationId, config)
      if (preview.outcome !== "preview") {
        return NextResponse.json(
          { success: false, outcome: preview.outcome, message: preview.message },
          { status: 422 }
        )
      }
      let services = null
      try {
        services = await loadTvPlanCommercialServices(supabase, auth.companyId, customerId)
      } catch {
        services = null
      }
      const commercial = presentTvPlanPreview({
        options: preview.options.map((option) => ({
          kind: option.kind,
          label: option.label,
          latamName: option.latamName,
          available: option.available,
        })),
        services,
      })
      return NextResponse.json({
        success: true,
        outcome: "preview",
        status: preview.status,
        currentPlanName: preview.currentPlanName,
        commercial: {
          status: commercial.status,
          message: commercial.message,
          currentMonthlyFee: commercial.currentMonthlyFee,
          tierLabel: commercial.tierLabel,
          componentLabels: commercial.componentLabels,
          conditionCode: commercial.conditionCode,
          discountPercent: commercial.discountPercent,
        },
        options: commercial.options,
      })
    }

    let result: LatamPlanChangeResult
    try {
      result = await changeLatamClientPlan(operationId, input.kind, config)
    } catch (error) {
      if (error instanceof LatamTvRequestError && error.kind === "unavailable") {
        await auditPlan(auth, customerId, operationId, null, null, "unavailable")
        return jsonError(NETWORK_MESSAGE, 502)
      }
      throw error
    }

    const auditResult = planAuditResult(result.outcome)
    if (auditResult) {
      await auditPlan(
        auth,
        customerId,
        operationId,
        "previousPlanName" in result ? result.previousPlanName ?? null : null,
        "requestedPlanName" in result ? result.requestedPlanName ?? null : null,
        auditResult
      )
    }

    if (result.outcome === "updated") {
      return NextResponse.json({
        success: true,
        outcome: "updated",
        status: result.status,
        planName: result.planName,
        message: "Plan actualizado correctamente en LATAM TV.",
      })
    }
    if (result.outcome === "unverified") {
      return NextResponse.json(
        {
          success: false,
          outcome: "unverified",
          status: result.status,
          planName: result.planName,
          message: result.message,
        },
        { status: 409 }
      )
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
    console.error("LATAM TV plan change failed")
    return jsonError(NETWORK_MESSAGE, 502)
  }
}

function planAuditResult(outcome: LatamPlanChangeResult["outcome"]): LatamPlanAuditResult | null {
  if (outcome === "busy") return null
  if (outcome === "updated") return "updated"
  if (outcome === "unverified") return "unverified"
  if (outcome === "not_found") return "not_found"
  if (outcome === "same_plan") return "same_plan"
  if (outcome === "plan_missing") return "plan_missing"
  return "rejected"
}

async function auditPlan(
  auth: SubscriptionsRouteContext,
  customerId: string,
  identifier: string,
  previousPlan: string | null,
  requestedPlan: string | null,
  result: LatamPlanAuditResult
) {
  try {
    await recordLatamPlanChangeAudit({
      sessionUser: auth.sessionUser,
      companyId: auth.companyId,
      customerId,
      identifier,
      previousPlan,
      requestedPlan,
      result,
    })
  } catch {
    console.error("No se pudo auditar el cambio de plan LATAM TV.")
  }
}
