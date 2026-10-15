import { NextResponse } from "next/server"

import { excludeTvOtSignup } from "@/lib/subscriptions/tv-ot-signups-actions"
import { requireSubscriptionsWriteContext } from "@/lib/subscriptions/route-context"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ taskId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response
  const { taskId } = await context.params
  if (!TASK_ID.test(taskId)) {
    return NextResponse.json({ success: false, message: "La OT no es válida." }, { status: 400 })
  }
  const userId = auth.sessionUser.authUserId?.trim() ?? ""
  try {
    const client = await createClient()
    const result = await excludeTvOtSignup(
      client,
      auth.companyId,
      createAdminClient(),
      userId,
      taskId
    )
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status })
    }
    return NextResponse.json({ success: true, message: result.message, item: result.item })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo quitar la propuesta.",
      },
      { status: 500 }
    )
  }
}
