import { NextResponse } from "next/server"

import { executeForceDelete } from "@/lib/admin/force-delete.server"
import { isForceDeleteEntityType } from "@/lib/admin/force-delete-types"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { createAdminClient } from "@/lib/supabase/admin"

type ForceDeleteRequestBody = {
  entityType?: string
  entityId?: string
}

export async function POST(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  let body: ForceDeleteRequestBody

  try {
    body = (await request.json()) as ForceDeleteRequestBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const entityType = body.entityType?.trim()
  const entityId = body.entityId?.trim()

  if (!isForceDeleteEntityType(entityType)) {
    return NextResponse.json(
      {
        success: false,
        message: "entityType no es válido para forzar eliminación.",
      },
      { status: 400 }
    )
  }

  if (!entityId) {
    return NextResponse.json(
      { success: false, message: "entityId es obligatorio." },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const result = await executeForceDelete(admin, {
      entityType,
      entityId,
      sessionUser: auth.sessionUser,
    })

    return NextResponse.json({
      success: true,
      entityType: result.entityType,
      entityId: result.entityId,
      entityLabel: result.entityLabel,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo forzar la eliminación del registro."

    const status =
      message.includes("administrador") || message.includes("Administrador")
        ? 403
        : message.includes("no existe") || message.includes("no encontrada")
          ? 404
          : 500

    return NextResponse.json({ success: false, message }, { status })
  }
}
