import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { syncEmployeesAuthMetadataByRoleId } from "@/lib/auth/sync-employee-auth-metadata"

export async function POST(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const body = (await request.json()) as { roleId?: string }
  const roleId = body.roleId?.trim()

  if (!roleId) {
    return NextResponse.json(
      { success: false, message: "roleId es obligatorio." },
      { status: 400 }
    )
  }

  if (!auth.sessionUser.companyId) {
    return NextResponse.json(
      { success: false, message: "Empresa no disponible para la sesión." },
      { status: 403 }
    )
  }

  const result = await syncEmployeesAuthMetadataByRoleId({
    roleId,
    companyId: auth.sessionUser.companyId,
  })

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.error },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    syncedCount: result.syncedCount,
    skippedWithoutAppUser: result.skippedWithoutAppUser,
  })
}
