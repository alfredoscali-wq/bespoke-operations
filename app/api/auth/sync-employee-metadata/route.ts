import { NextResponse } from "next/server"

import {
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR,
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS,
  ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
} from "@/lib/auth/admin-employee-tenant"
import { syncEmployeeAuthMetadata } from "@/lib/auth/sync-employee-auth-metadata"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"

export async function POST(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message, error: auth.message, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    )
  }

  const body = (await request.json()) as { employeeId?: string }
  const employeeId = body.employeeId?.trim()

  if (!employeeId) {
    return NextResponse.json(
      { success: false, message: "employeeId es obligatorio." },
      { status: 400 }
    )
  }

  const sessionCompanyId = auth.sessionUser.companyId?.trim()
  if (!sessionCompanyId) {
    return NextResponse.json(
      { success: false, message: ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR },
      { status: 403 }
    )
  }

  const result = await syncEmployeeAuthMetadata(employeeId, sessionCompanyId)

  if (!result.success) {
    const status =
      result.error === ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR
        ? ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS
        : 500
    return NextResponse.json(
      { success: false, message: result.error },
      { status }
    )
  }

  return NextResponse.json({ success: true })
}
