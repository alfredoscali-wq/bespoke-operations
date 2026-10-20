import { NextResponse } from "next/server"

import { customerActivateAuditInput } from "@/lib/audit/customers-audit"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import { planClients360CustomerActivation } from "@/lib/customers/customer-operational"
import { CUSTOMER_STATUS_PENDING_ACTIVATION } from "@/lib/customers/format"
import { requireIspWriteContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const client = await createClient()
  const existing = await client
    .from("customers")
    .select("id, name, customer_number, external_customer_code, status")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (existing.error) {
    return NextResponse.json(
      { success: false, message: existing.error.message },
      { status: 500 }
    )
  }
  if (!existing.data) {
    return NextResponse.json(
      { success: false, message: "No se encontró el cliente." },
      { status: 404 }
    )
  }

  const decision = planClients360CustomerActivation({
    status: existing.data.status,
    externalCustomerCode: existing.data.external_customer_code ?? undefined,
  })
  if (decision.outcome === "rejected") {
    return NextResponse.json(
      { success: false, message: decision.message },
      { status: 409 }
    )
  }

  const updated = await client
    .from("customers")
    .update({ status: "activo" })
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .eq("status", CUSTOMER_STATUS_PENDING_ACTIVATION)
    .is("deleted_at", null)
    .or("external_customer_code.is.null,external_customer_code.eq.")
    .select("id")
    .maybeSingle()

  if (updated.error) {
    return NextResponse.json(
      { success: false, message: updated.error.message },
      { status: 500 }
    )
  }
  if (!updated.data) {
    return NextResponse.json(
      { success: false, message: "Este cliente ya no está pendiente de activación." },
      { status: 409 }
    )
  }

  try {
    await recordAuditEventServer({
      ...customerActivateAuditInput(
        {
          id: existing.data.id,
          name: existing.data.name,
          customerNumber: existing.data.customer_number,
          externalCustomerCode: existing.data.external_customer_code ?? undefined,
          status: existing.data.status,
        },
        auth.sessionUser.displayName
      ),
      performedBy: { kind: "user", sessionUser: auth.sessionUser },
    })
  } catch (error) {
    await client
      .from("customers")
      .update({ status: existing.data.status })
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .eq("status", "activo")
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo registrar la auditoría de activación.",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: "Cliente activado correctamente.",
  })
}
