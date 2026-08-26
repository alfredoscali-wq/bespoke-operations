import { NextResponse } from "next/server"

import { ISP_BILLING_SAVED_MESSAGE } from "@/lib/isp/billing-constants"
import { validatePointOfSaleDraft } from "@/lib/isp/billing-integrity"
import {
  listIspBillingPointOfSales,
  upsertIspBillingPointOfSale,
} from "@/lib/isp/billing-queries"
import type { IspBillingPointOfSaleDraft } from "@/lib/isp/billing-types"
import {
  requireIspBillingReadContext,
  requireIspBillingWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const items = await listIspBillingPointOfSales(client, auth.companyId)
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el punto de venta.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return savePointOfSale(request)
}

export async function PUT(request: Request) {
  return savePointOfSale(request)
}

async function savePointOfSale(request: Request) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

  let body: IspBillingPointOfSaleDraft & { companyId?: string }
  try {
    body = (await request.json()) as IspBillingPointOfSaleDraft & {
      companyId?: string
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const issues = validatePointOfSaleDraft(body)
  if (issues.length > 0) {
    return NextResponse.json(
      { success: false, message: issues[0]?.message },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const item = await upsertIspBillingPointOfSale(client, auth.companyId, body)
    return NextResponse.json({
      success: true,
      message: ISP_BILLING_SAVED_MESSAGE,
      item,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el punto de venta.",
      },
      { status: 400 }
    )
  }
}
