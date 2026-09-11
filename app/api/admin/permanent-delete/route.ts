import { NextResponse } from "next/server"

import { executePermanentDelete } from "@/lib/admin/permanent-delete"
import {
  PermanentDeleteNotFoundError,
  resolvePermanentDeleteSessionCompanyId,
} from "@/lib/admin/permanent-delete-policy"
import { isPermanentDeleteEntityType } from "@/lib/admin/permanent-delete-types"
import { ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR } from "@/lib/auth/admin-employee-tenant"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { createAdminClient } from "@/lib/supabase/admin"

type PermanentDeleteRequestBody = {
  entityType?: string
  entityId?: string
  companyId?: string
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message, error: auth.message, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    )
  }

  const sessionCompanyId = resolvePermanentDeleteSessionCompanyId(auth.sessionUser)
  if (!sessionCompanyId) {
    return NextResponse.json(
      {
        success: false,
        message: ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
        error: ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
      },
      { status: 403 }
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
        message: "entityType no es válido.",
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
      companyId: sessionCompanyId,
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
    if (error instanceof PermanentDeleteNotFoundError) {
      return jsonError(error.message, error.status)
    }

    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar definitivamente el registro."

    if (message === ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR) {
      return jsonError(message, 403)
    }

    return jsonError(message, 500)
  }
}
