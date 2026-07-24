import { NextResponse } from "next/server"

import {
  recordUserCreateAudit,
  recordUserProvisionAudit,
} from "@/lib/audit/users-audit.server"
import { provisionAuthIdentityForEmployee } from "@/lib/auth/auth-provisioning-service"
import { getSessionUser } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchEmployeeById } from "@/lib/supabase/employees.queries"

type ProvisionRequestBody = {
  employeeId?: string
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Debe iniciar sesión para provisionar accesos.",
      },
      { status: 401 }
    )
  }

  if (sessionUser.systemRole !== "administrador") {
    return NextResponse.json(
      {
        success: false,
        error: "Solo un administrador puede provisionar accesos de empleados.",
      },
      { status: 403 }
    )
  }

  let body: ProvisionRequestBody

  try {
    body = (await request.json()) as ProvisionRequestBody
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
    const result = await provisionAuthIdentityForEmployee(employeeId)

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
    }

    const admin = createAdminClient()
    const employeeResult = await fetchEmployeeById(admin, employeeId)
    const employee = employeeResult.data

    if (employee) {
      if (result.created) {
        await recordUserCreateAudit({
          performedBy: sessionUser,
          employee,
          authUserId: result.authUserId,
        })
      }
      await recordUserProvisionAudit({
        performedBy: sessionUser,
        employee,
        authUserId: result.authUserId,
      })
    }

    return NextResponse.json(
      {
        success: true,
        authUserId: result.authUserId,
        reused: result.reused,
        created: result.created,
      },
      { status: result.created ? 201 : 200 }
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo provisionar el acceso del empleado."

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
