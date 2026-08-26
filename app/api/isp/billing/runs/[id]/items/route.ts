import { NextResponse } from "next/server"

import { getIspBillingRun } from "@/lib/isp/billing-run-queries"
import { requireIspBillingReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const url = new URL(request.url)
  const filter = url.searchParams.get("filter") ?? "all"
  const documentType = url.searchParams.get("documentType") ?? ""
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase()

  try {
    const client = await createClient()
    const detail = await getIspBillingRun(client, auth.companyId, id)
    let items = detail.items
    if (filter === "proportional") {
      items = items.filter((item) => item.proportionalAmount > 0)
    } else if (filter === "errors") {
      items = items.filter((item) => item.status === "error")
    } else if (filter === "warnings") {
      items = items.filter((item) => Boolean(item.warningMessage) || item.requiresReview)
    }
    if (documentType) {
      items = items.filter((item) => item.documentType === documentType)
    }
    if (search) {
      items = items.filter(
        (item) =>
          item.customerName.toLowerCase().includes(search) ||
          item.serviceName.toLowerCase().includes(search) ||
          (item.catalogCode ?? "").toLowerCase().includes(search)
      )
    }
    return NextResponse.json({ success: true, items, groups: detail.groups })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudieron cargar los ítems.",
      },
      { status: 404 }
    )
  }
}
