import "server-only"

import { NextResponse } from "next/server"

import { readLatamTvConfig } from "@/lib/integrations/latam-tv/config"
import {
  getLatamTvPlans,
  heldLatamSignup,
  refreshLatamSignupIdentity,
  signUpLatamTvClient,
} from "@/lib/integrations/latam-tv/client"
import { createLatamSignupAttemptStore } from "@/lib/integrations/latam-tv/signup-attempt"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { latamIdentifierFromCustomer } from "@/lib/integrations/latam-tv/identifier"
import { matchLatamTvPlans } from "@/lib/integrations/latam-tv/plans"
import {
  assessLatamSignup,
  isLatamSignupTvKind,
  latamPlanIdForTvKind,
  latamSignupCredentialGap,
  latamSignupCredentialMessage,
  latamSignupCustomerGaps,
  latamSignupPlanGap,
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

function readRequest(
  value: unknown
): { confirm: boolean; retry: boolean; tvKind: LatamSignupTvKind } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!isLatamSignupTvKind(record.tvKind)) return null
  return { confirm: record.confirm === true, retry: record.retry === true, tvKind: record.tvKind }
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
        "id, company_id, external_customer_code, customer_number, deleted_at, name, dni, email, phone, address"
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

    const identitySignup = resolved.status !== "ready"
    const customer = {
      name: data?.name ?? "",
      dni: data?.dni ?? null,
      email: data?.email ?? null,
      phone: data?.phone ?? null,
      address: data?.address ?? null,
      identifier: resolved.status === "ready" ? resolved.identifier : null,
      tvKind: input.tvKind,
      identitySignup,
    }
    const credentialGap = latamSignupCredentialGap(customer.dni, customer.email)
    if (credentialGap) {
      return NextResponse.json(
        {
          success: false,
          outcome: "missing",
          message: latamSignupCredentialMessage(credentialGap),
        },
        { status: 422 }
      )
    }
    const customerGaps = latamSignupCustomerGaps(customer)
    if (customerGaps.length > 0) {
      return NextResponse.json(
        { success: false, outcome: "missing", missing: customerGaps },
        { status: 422 }
      )
    }

    const config = readLatamTvConfig()
    if (!config) {
      console.error(
        "LATAM TV no está configurado (LATAM_TV_API_URL / LATAM_TV_API_TOKEN)."
      )
      throw new LatamTvRequestError("not_configured")
    }

    const diagnosis = matchLatamTvPlans(await getLatamTvPlans(config))
    const assessment = assessLatamSignup({
      ...customer,
      planId: latamPlanIdForTvKind(input.tvKind, diagnosis),
      planGap: latamSignupPlanGap(input.tvKind, diagnosis),
    })
    if (!assessment.ready) {
      return NextResponse.json(
        { success: false, outcome: "missing", missing: assessment.missing },
        { status: 422 }
      )
    }
    if (!input.confirm) {
      if (identitySignup) {
        let held: ReturnType<typeof heldLatamSignup> = null
        try {
          held = heldLatamSignup(
            await createLatamSignupAttemptStore(supabase, customerId).read()
          )
        } catch {
          return jsonError("No se pudo preparar el alta en LATAM TV.", 400)
        }
        if (held) {
          return NextResponse.json(
            { success: false, outcome: held.outcome, message: held.message },
            { status: 409 }
          )
        }
      }
      return NextResponse.json({
        success: true,
        outcome: "preview",
        preview: {
          customerName: assessment.preview.customerName,
          identifier: assessment.preview.identifier,
          username: assessment.preview.username,
          planLabel: assessment.preview.planLabel,
        },
      })
    }

    const signupAttempt = identitySignup
      ? createLatamSignupAttemptStore(supabase, customerId)
      : undefined
    const latam = { ...config, signupAttempt }
    const result = input.retry
      ? await refreshLatamSignupIdentity(assessment.body, latam)
      : await signUpLatamTvClient(assessment.body, latam)
    if (result.outcome === "pending_sync") {
      return NextResponse.json(
        { success: false, outcome: "pending_sync", message: result.message },
        { status: 409 }
      )
    }
    if (result.outcome === "failed") {
      return NextResponse.json(
        { success: false, outcome: "failed", message: result.message },
        { status: 409 }
      )
    }
    if (result.outcome === "created") {
      return NextResponse.json({
        success: true,
        outcome: "created",
        username: result.username ?? assessment.preview.username,
        identifier: result.identifier,
        planLabel: result.planName ?? assessment.preview.planLabel,
        status: result.status,
        iptvId: result.iptvId,
      })
    }
    if (result.outcome === "unverified") {
      return NextResponse.json(
        { success: false, outcome: "unverified", message: result.message },
        { status: 409 }
      )
    }
    if (result.outcome === "already_exists") {
      return NextResponse.json({
        success: true,
        outcome: "already_exists",
        status: result.status,
        identifier: result.identifier ?? null,
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
