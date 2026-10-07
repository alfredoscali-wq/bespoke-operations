import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import { signUpLatamTvClient } from "@/lib/integrations/latam-tv/client"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { latamIdentifierFromCustomer } from "@/lib/integrations/latam-tv/identifier"
import {
  assessLatamSignup,
  isLatamSignupTvKind,
  latamPlanIdForTvKind,
  type LatamSignupTvKind,
} from "@/lib/integrations/latam-tv/signup"
import { requireSubscriptionsWriteContext } from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ customerId: string }> }

const CUSTOMER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

function readRequest(value: unknown): { confirm: boolean; tvKind: LatamSignupTvKind } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!isLatamSignupTvKind(record.tvKind)) return null
  return { confirm: record.confirm === true, tvKind: record.tvKind }
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
  const input = readRequest(payload)
  if (!input) return jsonError("Plan de TV no reconocido.", 422)

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, company_id, external_customer_code, deleted_at, name, dni, email, phone, address"
      )
      .eq("id", customerId)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return jsonError("No se pudo preparar el alta en LATAM TV.", 400)

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

    const assessment = assessLatamSignup({
      name: data?.name ?? "",
      dni: data?.dni ?? null,
      email: data?.email ?? null,
      phone: data?.phone ?? null,
      address: data?.address ?? null,
      identifier: resolved.status === "ready" ? resolved.identifier : null,
      tvKind: input.tvKind,
      planId: latamPlanIdForTvKind(input.tvKind),
    })
    if (!assessment.ready) {
      return NextResponse.json(
        { success: false, outcome: "missing", missing: assessment.missing },
        { status: 422 }
      )
    }
    if (!input.confirm) {
      return NextResponse.json({
        success: true,
        outcome: "preview",
        preview: assessment.preview,
      })
    }

    const config = readLatamTvConfig()
    if (!config) {
      console.error(
        "LATAM TV no está configurado (LATAM_TV_API_URL / LATAM_TV_API_TOKEN)."
      )
      throw new LatamTvRequestError("not_configured")
    }

    const result = await signUpLatamTvClient(assessment.body, config)
    if (result.outcome === "created") {
      return NextResponse.json({
        success: true,
        outcome: "created",
        username: assessment.preview.username,
        initialPassword: assessment.preview.initialPassword,
        identifier: assessment.preview.identifier,
        planLabel: assessment.preview.planLabel,
      })
    }
    if (result.outcome === "already_exists") {
      return NextResponse.json({
        success: true,
        outcome: "already_exists",
        status: result.status,
        message: "El cliente ya existe en LATAM TV.",
      })
    }
    return NextResponse.json(
      { success: false, outcome: "rejected", message: result.message },
      { status: 422 }
    )
  } catch (error) {
    if (error instanceof LatamTvRequestError) {
      if (error.kind === "not_configured") return jsonError(error.message, 503)
      if (error.kind === "invalid_identifier") return jsonError(error.message, 422)
      return jsonError(error.message, 502)
    }
    console.error("LATAM TV signup failed")
    return jsonError("No se pudo completar el alta en LATAM TV.", 502)
  }
}
