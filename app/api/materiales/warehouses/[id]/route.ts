import { NextResponse } from "next/server"

import { requireMaterialsMutationContext } from "@/lib/materials/route-context"
import { updateWarehouse } from "@/lib/supabase/materials.queries"
import { createClient } from "@/lib/supabase/server"
import type { UpdateWarehousePayload } from "@/lib/types/supabase/materials"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMaterialsMutationContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let payload: UpdateWarehousePayload
  try {
    payload = (await request.json()) as UpdateWarehousePayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await updateWarehouse(client, id, payload)

  if (result.error || !result.data) {
    const status =
      result.error?.code === "VALIDATION" || result.error?.code === "NOT_FOUND"
        ? 400
        : 500
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo actualizar el depósito.",
      },
      { status }
    )
  }

  return NextResponse.json({
    success: true,
    warehouse: result.data,
  })
}
