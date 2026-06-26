import { NextResponse } from "next/server"

import { recordUserPasswordResetAudit } from "@/lib/audit/users-audit.server"
import { resetEmployeePassword } from "@/lib/auth/reset-employee-password"
import { getSessionUser } from "@/lib/auth/session"
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

  try {
    const result = await resetEmployeePassword(employeeId)

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
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

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo restablecer la contraseña del empleado."

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
