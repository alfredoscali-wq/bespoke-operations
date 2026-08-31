import { NextResponse } from "next/server"

import { requireSubscriptionsWriteContext } from "@/lib/subscriptions/route-context"
import type { TvPlanWriteDraft } from "@/lib/subscriptions/tv-catalog"
import {
  setTvCatalogPlanActive,
  updateTvCatalogPlan,
} from "@/lib/supabase/subscriptions.queries"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: (Partial<TvPlanWriteDraft> & { isActive?: boolean }) | TvPlanWriteDraft
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    if (typeof body.isActive === "boolean" && Object.keys(body).length <= 2) {
      const result = await setTvCatalogPlanActive(
        client,
        auth.companyId,
        id,
        body.isActive
      )
      if (result.error || !result.data) {
        return NextResponse.json(
          {
            success: false,
            message: result.error?.message ?? "No se pudo actualizar el plan TV.",
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: true, item: result.data })
    }

    const result = await updateTvCatalogPlan(
      client,
      auth.companyId,
      id,
      body as TvPlanWriteDraft
    )
    if (result.error || !result.data) {
      return NextResponse.json(
        {
          success: false,
          message: result.error?.message ?? "No se pudo actualizar el plan TV.",
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ success: true, item: result.data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el plan TV.",
      },
      { status: 400 }
    )
  }
}
