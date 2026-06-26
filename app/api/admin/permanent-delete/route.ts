import { NextResponse } from "next/server"

import { executePermanentDelete } from "@/lib/admin/permanent-delete"
import type { PermanentDeleteEntityType } from "@/lib/admin/permanent-delete"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { createAdminClient } from "@/lib/supabase/admin"

type PermanentDeleteRequestBody = {
  entityType?: PermanentDeleteEntityType
  entityId?: string
}

function isPermanentDeleteEntityType(
  value: string | undefined
): value is PermanentDeleteEntityType {
  return value === "customer" || value === "task"
}

export async function POST(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  let body: PermanentDeleteRequestBody

  try {
    body = (await request.json()) as PermanentDeleteRequestBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const entityType = body.entityType?.trim()
  const entityId = body.entityId?.trim()

  if (!isPermanentDeleteEntityType(entityType)) {
    return NextResponse.json(
      {
        success: false,
        message: "entityType debe ser customer o task.",
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
    const result = await executePermanentDelete(admin, {
      entityType,
      entityId,
      sessionUser: auth.sessionUser,
    })

    return NextResponse.json({
      success: true,
      entityType: result.entityType,
      entityId: result.entityId,
      entityLabel: result.entityLabel,
      deletedTasks: result.deletedTasks,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar definitivamente el registro."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
