import { NextResponse } from "next/server"

import { ISP_SUBSCRIBER_NOT_FOUND_MESSAGE } from "@/lib/isp/constants"
import { getIspCustomerDetail } from "@/lib/isp/queries"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import {
  getCustomerById,
  updateCustomer,
} from "@/lib/supabase/customers.queries"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    const detail = await getIspCustomerDetail(client, auth.companyId, id)
    if (!detail) {
      return NextResponse.json(
        { success: false, message: ISP_SUBSCRIBER_NOT_FOUND_MESSAGE },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, detail })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el cliente.",
      },
      { status: 500 }
    )
  }
}

type IdentityBody = {
  name?: string
  dni?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  locality?: string | null
  externalCustomerCode?: string | null
  technology?: string | null
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let body: IdentityBody
  try {
    body = (await request.json()) as IdentityBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const name = body.name?.trim() ?? ""
  if (!name) {
    return NextResponse.json(
      { success: false, message: "El nombre es obligatorio." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const { data: owned, error: ownedError } = await client
      .from("customers")
      .select("id")
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle()

    if (ownedError) throw new Error(ownedError.message)
    if (!owned) {
      return NextResponse.json(
        { success: false, message: ISP_SUBSCRIBER_NOT_FOUND_MESSAGE },
        { status: 404 }
      )
    }

    const { data: member, error: memberError } = await client
      .from("isp_subscribers")
      .select("id")
      .eq("company_id", auth.companyId)
      .eq("customer_id", id)
      .is("deleted_at", null)
      .maybeSingle()

    if (memberError) throw new Error(memberError.message)
    if (!member) {
      return NextResponse.json(
        { success: false, message: ISP_SUBSCRIBER_NOT_FOUND_MESSAGE },
        { status: 404 }
      )
    }

    const updated = await updateCustomer(client, id, {
      name,
      dni: body.dni,
      phone: body.phone,
      whatsapp: body.whatsapp,
      email: body.email,
      address: body.address,
      locality: body.locality,
      externalCustomerCode: body.externalCustomerCode,
      technology: body.technology,
    })
    if (updated.error || !updated.data) {
      return NextResponse.json(
        {
          success: false,
          message: updated.error?.message ?? "No se pudo actualizar al cliente.",
        },
        { status: 400 }
      )
    }

    const stillMember = await client
      .from("isp_subscribers")
      .select("id")
      .eq("company_id", auth.companyId)
      .eq("customer_id", id)
      .is("deleted_at", null)
      .maybeSingle()
    if (!stillMember.data) {
      return NextResponse.json(
        { success: false, message: ISP_SUBSCRIBER_NOT_FOUND_MESSAGE },
        { status: 500 }
      )
    }

    const customer = await getCustomerById(client, id)
    return NextResponse.json({
      success: true,
      customer: customer.data ?? updated.data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar al cliente.",
      },
      { status: 400 }
    )
  }
}
