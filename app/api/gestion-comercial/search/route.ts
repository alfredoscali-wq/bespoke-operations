import { NextResponse } from "next/server"

import { searchCommercialModule } from "@/lib/commercial/search-service"
import { requireGestionComercialReadContext } from "@/lib/commercial/route-context"
import { createClient } from "@/lib/supabase/server"
import { COMMERCIAL_SEARCH_MIN_CHARS } from "@/lib/types/commercial-search"

export async function GET(request: Request) {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() ?? ""

  if (q.length < COMMERCIAL_SEARCH_MIN_CHARS) {
    return NextResponse.json({
      success: true,
      query: q,
      groups: [],
      clients: [],
      activities: [],
    })
  }

  const client = await createClient()
  const result = await searchCommercialModule(client, auth.companyId, q)

  return NextResponse.json({
    success: true,
    ...result,
  })
}
