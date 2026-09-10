import { NextResponse } from "next/server"

import { recordUserPasswordResetAudit } from "@/lib/audit/users-audit.server"
import {
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR,
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS,
  ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
} from "@/lib/auth/admin-employee-tenant"
import { resetEmployeePassword } from "@/lib/auth/reset-employee-password"
import { getSessionUser } from "@/lib/auth/session"
import {
  denyIfPasswordChangeRequired,
  passwordChangeRequiredResponse,
} from "@/lib/auth/require-password-compliant-session"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchEmployeeById } from "@/lib/supabase/employees.queries"

type ResetPasswordRequestBody = {
  employeeId?: string
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Debe iniciar sesión para restablecer contraseñas.",
      },
      { status: 401 }
    )
  }

  const passwordDenial = denyIfPasswordChangeRequired(sessionUser)
  if (passwordDenial) {
    return passwordChangeRequiredResponse()
  }

  if (sessionUser.systemRole !== "administrador") {
    return NextResponse.json(
      {
        success: false,
        error: "Solo un administrador puede restablecer contraseñas de empleados.",
      },
      { status: 403 }
    )
  }

  let body: ResetPasswordRequestBody

  try {
    body = (await request.json()) as ResetPasswordRequestBody
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Cuerpo JSON inválido.",
      },
      { status: 400 }
    )
  }

  const employeeId = body.employeeId?.trim()

  if (!employeeId) {
    return NextResponse.json(
      {
        success: false,
        error: "employeeId es obligatorio.",
      },
      { status: 400 }
    )
  }

  const sessionCompanyId = sessionUser.companyId?.trim()
  if (!sessionCompanyId) {
    return NextResponse.json(
      {
        success: false,
        error: ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
      },
      { status: 403 }
    )
  }

  try {
    const result = await resetEmployeePassword(employeeId, sessionCompanyId)

    if (!result.success) {
      const status =
        result.error === ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR
          ? ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS
          : 422
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      )
    }

    const admin = createAdminClient()
    const employeeResult = await fetchEmployeeById(admin, employeeId)
    const employee = employeeResult.data

    if (employee) {
      await recordUserPasswordResetAudit({
        performedBy: sessionUser,
        employee,
      })
    }

    return NextResponse.json(
      {
        success: true,
        temporaryPassword: result.temporaryPassword,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo restablecer la contraseña del empleado.",
      },
      { status: 500 }
    )
  }
}
