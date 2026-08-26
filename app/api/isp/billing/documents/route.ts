import { NextResponse } from "next/server"

import { ISP_BILLING_DOCUMENT_SAVED } from "@/lib/isp/billing-constants"
import type { IspBillingDocumentDraftInput } from "@/lib/isp/billing-document-types"
import {
  createIspBillingDocument,
  listIspBillingDocuments,
  toBillingDocumentList,
} from "@/lib/isp/billing-document-queries"
import {
  requireIspBillingReadContext,
  requireIspBillingWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  try {
    const client = await createClient()
    const documents = await listIspBillingDocuments(client, auth.companyId, {
      search: url.searchParams.get("search") ?? undefined,
      documentType: url.searchParams.get("documentType") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      pointOfSaleId: url.searchParams.get("pointOfSaleId") ?? undefined,
    })
    return NextResponse.json({
      success: true,
      items: toBillingDocumentList(documents),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los comprobantes.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

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
    const document = await createIspBillingDocument(client, auth.companyId, body)
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
          error instanceof Error ? error.message : "No se pudo crear el comprobante.",
      },
      { status: 400 }
    )
  }
}
