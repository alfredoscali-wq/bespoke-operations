import { NextResponse } from "next/server"

import { requireMaterialsMutationContext } from "@/lib/materials/route-context"
import { recordMaterialMovement } from "@/lib/supabase/materials.queries"
import { createClient } from "@/lib/supabase/server"
import type { RecordMaterialMovementPayload } from "@/lib/types/supabase/materials"

export async function POST(request: Request) {
  const auth = await requireMaterialsMutationContext()
  if (!auth.ok) return auth.response

  let payload: RecordMaterialMovementPayload
  try {
    payload = (await request.json()) as RecordMaterialMovementPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  if (!payload.materialId || !payload.warehouseId || !payload.movementType) {
    return NextResponse.json(
      { success: false, message: "Material, depósito y tipo son obligatorios." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await recordMaterialMovement(client, payload)

  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo registrar el movimiento.",
      },
      { status: result.error?.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json({
    success: true,
    movementId: result.data.movementId,
  })
}
