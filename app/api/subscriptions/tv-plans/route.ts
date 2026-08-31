import { NextResponse } from "next/server"

import {
  requireSubscriptionsReadContext,
  requireSubscriptionsWriteContext,
} from "@/lib/subscriptions/route-context"
import type { TvPlanWriteDraft } from "@/lib/subscriptions/tv-catalog"
import {
  createTvCatalogPlan,
  fetchTvCatalogPlans,
} from "@/lib/supabase/subscriptions.queries"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireSubscriptionsReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const result = await fetchTvCatalogPlans(client, auth.companyId)
    if (result.error) {
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status: 400 }
      )
    }
    return NextResponse.json({ success: true, items: result.data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los planes TV.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  let draft: TvPlanWriteDraft
  try {
    draft = (await request.json()) as TvPlanWriteDraft
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const result = await createTvCatalogPlan(client, auth.companyId, draft)
    if (result.error || !result.data) {
      return NextResponse.json(
        { success: false, message: result.error?.message ?? "No se pudo crear el plan TV." },
        { status: 400 }
      )
    }
    return NextResponse.json({ success: true, item: result.data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear el plan TV.",
      },
      { status: 400 }
    )
  }
}
