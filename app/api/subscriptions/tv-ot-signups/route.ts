import { NextResponse } from "next/server"

import { countTvOtSignups } from "@/lib/subscriptions/tv-ot-signups"
import { readTvOtSignupList } from "@/lib/subscriptions/tv-ot-signups-actions"
import { requireSubscriptionsReadContext } from "@/lib/subscriptions/route-context"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET() {
  const auth = await requireSubscriptionsReadContext()
  if (!auth.ok) return auth.response
  try {
    const client = await createClient()
    const result = await readTvOtSignupList(client, auth.companyId, createAdminClient())
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status })
    }
    return NextResponse.json({
      success: true,
      persistenceAvailable: result.feed.persistenceAvailable,
      items: result.feed.items,
      counts: countTvOtSignups(result.feed.items),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "No se pudieron cargar las altas de TV.",
      },
      { status: 500 }
    )
  }
}
