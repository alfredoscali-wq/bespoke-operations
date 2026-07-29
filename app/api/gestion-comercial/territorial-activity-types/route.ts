import { NextResponse } from "next/server"

import { requireGestionComercialReadContext } from "@/lib/commercial/route-context"
import { createClient } from "@/lib/supabase/server"
import { listCommercialTerritorialActivityTypes } from "@/lib/supabase/commercial-territorial-activity-types.queries"

export async function GET() {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const client = await createClient()
  const result = await listCommercialTerritorialActivityTypes(
    client,
    auth.companyId,
    { activeOnly: true }
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, types: result.data })
}
