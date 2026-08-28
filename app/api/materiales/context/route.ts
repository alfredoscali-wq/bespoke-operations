import { NextResponse } from "next/server"

import { requireMaterialsReadContext } from "@/lib/materials/route-context"
import {
  fetchInventoryRows,
  fetchMaterialIdsWithMovements,
  fetchMaterialsSummary,
  resolveWarehouseSelection,
} from "@/lib/supabase/materials.queries"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireMaterialsReadContext()
  if (!auth.ok) return auth.response

  const client = await createClient()

  const [summaryResult, inventoryResult, warehouseContextResult, movementIds] =
    await Promise.all([
      fetchMaterialsSummary(client, auth.companyId),
      fetchInventoryRows(client, auth.companyId),
      resolveWarehouseSelection(client, auth.companyId),
      fetchMaterialIdsWithMovements(client, auth.companyId),
    ])

  if (summaryResult.error) {
    return NextResponse.json(
      { success: false, message: summaryResult.error.message },
      { status: 500 }
    )
  }

  if (inventoryResult.error) {
    return NextResponse.json(
      { success: false, message: inventoryResult.error.message },
      { status: 500 }
    )
  }

  if (warehouseContextResult.error) {
    return NextResponse.json(
      { success: false, message: warehouseContextResult.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    summary: summaryResult.data,
    inventory: inventoryResult.data,
    warehouseContext: warehouseContextResult.data,
    materialIdsWithMovements: Array.from(movementIds),
  })
}
