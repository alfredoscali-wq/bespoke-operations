import { NextResponse } from "next/server"

import { buildOtPlanOptionsFromCatalog } from "@/lib/isp/catalog-integrity"
import { listIspCatalogForOt } from "@/lib/isp/catalog-queries"
import { requireIspCatalogOtReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"
import type { WorkOrderTechnology } from "@/lib/tasks/commercial-plan"

export async function GET(request: Request) {
  const auth = await requireIspCatalogOtReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const technology = url.searchParams.get("technology") as WorkOrderTechnology | ""
  const includeId = url.searchParams.get("includeId")
  const safeIncludeId =
    includeId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      includeId
    )
      ? includeId
      : null

  if (technology !== "fiber" && technology !== "wireless") {
    return NextResponse.json({ success: true, plans: [] })
  }

  try {
    const client = await createClient()
    const items = await listIspCatalogForOt(
      client,
      auth.companyId,
      safeIncludeId
    )
    const plans = buildOtPlanOptionsFromCatalog(items, technology, {
      includeId: safeIncludeId,
    })
    return NextResponse.json({ success: true, plans })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los planes.",
      },
      { status: 500 }
    )
  }
}
