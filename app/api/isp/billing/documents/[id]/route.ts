import { NextResponse } from "next/server"

import { ISP_BILLING_DOCUMENT_SAVED } from "@/lib/isp/billing-constants"
import type { IspBillingDocumentDraftInput } from "@/lib/isp/billing-document-types"
import {
  getIspBillingDocument,
  updateIspBillingDocument,
} from "@/lib/isp/billing-document-queries"
import {
  requireIspBillingReadContext,
  requireIspBillingWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const document = await getIspBillingDocument(client, auth.companyId, id)
    return NextResponse.json({ success: true, document })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo cargar el comprobante.",
      },
      { status: 404 }
    )
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: IspBillingDocumentDraftInput
  try {
    body = (await request.json()) as IspBillingDocumentDraftInput
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const document = await updateIspBillingDocument(
      client,
      auth.companyId,
      id,
      body
    )
    return NextResponse.json({
      success: true,
      message: ISP_BILLING_DOCUMENT_SAVED,
      document,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el comprobante.",
      },
      { status: 400 }
    )
  }
}
