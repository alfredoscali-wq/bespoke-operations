import { NextResponse } from "next/server"

import {
  billingDocumentPdfFileName,
  buildBillingDocumentPdf,
  loadBillingLogoDataUrl,
} from "@/lib/isp/billing-document-pdf"
import { getIspBillingDocument } from "@/lib/isp/billing-document-queries"
import { requireIspBillingReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const client = await createClient()
    const document = await getIspBillingDocument(client, auth.companyId, id)
    const logoDataUrl = await loadBillingLogoDataUrl(document.issuerLogoUrlSnapshot)
    const bytes = buildBillingDocumentPdf(document, { logoDataUrl })
    const fileName = billingDocumentPdfFileName(document)
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo generar el PDF.",
      },
      { status: 400 }
    )
  }
}
