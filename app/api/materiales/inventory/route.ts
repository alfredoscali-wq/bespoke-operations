import { NextResponse } from "next/server"

import { requireMaterialsReadContext } from "@/lib/materials/route-context"
import { fetchInventoryRows } from "@/lib/supabase/materials.queries"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireMaterialsReadContext()
  if (!auth.ok) return auth.response

  const client = await createClient()
  const result = await fetchInventoryRows(client, auth.companyId)

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    inventory: result.data,
  })
}
