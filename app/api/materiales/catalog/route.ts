import { NextResponse } from "next/server"

import { requireMaterialsReadContext } from "@/lib/materials/route-context"
import { fetchMaterialCatalog } from "@/lib/supabase/materials.queries"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireMaterialsReadContext()
  if (!auth.ok) return auth.response

  const client = await createClient()
  const result = await fetchMaterialCatalog(client, auth.companyId, {
    activeOnly: true,
  })

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    catalog: result.data,
  })
}
