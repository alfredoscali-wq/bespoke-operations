import { NextResponse } from "next/server"

import {
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR,
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS,
  ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
} from "@/lib/auth/admin-employee-tenant"
import { softDeleteEmployeeAccess } from "@/lib/auth/soft-delete-employee-access"
import { getSessionUser } from "@/lib/auth/session"
import {
  denyIfPasswordChangeRequired,
  passwordChangeRequiredResponse,
} from "@/lib/auth/require-password-compliant-session"

type SoftDeleteRequestBody = {
  employeeId?: string
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Debe iniciar sesión para eliminar usuarios.",
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
        error: "Solo un administrador puede eliminar usuarios.",
      },
      { status: 403 }
    )
  }

  let body: SoftDeleteRequestBody

  try {
    body = (await request.json()) as SoftDeleteRequestBody
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
    const result = await softDeleteEmployeeAccess(employeeId, sessionCompanyId)

    if (!result.success) {
      const status =
        result.error === ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR
          ? ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS
          : 422
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar el usuario."

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
