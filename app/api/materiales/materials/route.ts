import { NextResponse } from "next/server"

import {
  requireMaterialsMutationContext,
  requireMaterialsReadContext,
} from "@/lib/materials/route-context"
import { createMaterial } from "@/lib/supabase/materials.queries"
import { createClient } from "@/lib/supabase/server"
import type { CreateMaterialPayload } from "@/lib/types/supabase/materials"

export async function POST(request: Request) {
  const auth = await requireMaterialsMutationContext()
  if (!auth.ok) return auth.response

  let payload: CreateMaterialPayload
  try {
    payload = (await request.json()) as CreateMaterialPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const code = payload.code?.trim() ?? ""
  const name = payload.name?.trim() ?? ""
  const unit = payload.unit?.trim() ?? ""

  if (!code || !name || !unit || !payload.category) {
    return NextResponse.json(
      {
        success: false,
        message: "Código, nombre, categoría y unidad son obligatorios.",
      },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await createMaterial(client, auth.companyId, {
    ...payload,
    code,
    name,
    unit,
  })

  if (result.error || !result.data) {
    const status =
      result.error?.code === "VALIDATION" || result.error?.code === "DUPLICATE"
        ? 400
        : 500
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo crear el material.",
      },
      { status }
    )
  }

  return NextResponse.json(
    { success: true, material: result.data },
    { status: 201 }
  )
}

export async function GET() {
  const auth = await requireMaterialsReadContext()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    success: true,
    message: "Use /api/materiales/inventory para el listado de stock.",
  })
}
