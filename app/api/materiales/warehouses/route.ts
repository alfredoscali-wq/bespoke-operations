import { NextResponse } from "next/server"

import {
  requireMaterialsMutationContext,
  requireMaterialsReadContext,
} from "@/lib/materials/route-context"
import {
  createWarehouse,
  fetchWarehouses,
} from "@/lib/supabase/materials.queries"
import { createClient } from "@/lib/supabase/server"
import type { CreateWarehousePayload } from "@/lib/types/supabase/materials"

export async function GET() {
  const auth = await requireMaterialsReadContext()
  if (!auth.ok) return auth.response

  const client = await createClient()
  const result = await fetchWarehouses(client, auth.companyId)

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    warehouses: result.data,
  })
}

export async function POST(request: Request) {
  const auth = await requireMaterialsMutationContext()
  if (!auth.ok) return auth.response

  let payload: CreateWarehousePayload
  try {
    payload = (await request.json()) as CreateWarehousePayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const name = payload.name?.trim() ?? ""
  if (!name) {
    return NextResponse.json(
      { success: false, message: "El nombre del depósito es obligatorio." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await createWarehouse(client, { name })

  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo crear el depósito.",
      },
      { status: result.error?.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json(
    { success: true, warehouse: result.data },
    { status: 201 }
  )
}
