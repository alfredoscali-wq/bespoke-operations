import { NextResponse } from "next/server"

import {
  recordUserCreateAudit,
  recordUserProvisionAudit,
} from "@/lib/audit/users-audit.server"
import {
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR,
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS,
  ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
} from "@/lib/auth/admin-employee-tenant"
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
    const result = await provisionAuthIdentityForEmployee(
      employeeId,
      sessionCompanyId
    )

    if (!result.success) {
      const status =
        result.error === ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR
          ? ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS
          : 422
      return NextResponse.json(result, { status })
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

    const payload: {
      success: true
      authUserId: string
      reused: boolean
      created: boolean
      temporaryPassword?: string
    } = {
      success: true,
      authUserId: result.authUserId,
      reused: result.reused,
      created: result.created,
    }
    if (result.temporaryPassword) {
      payload.temporaryPassword = result.temporaryPassword
    }

    return NextResponse.json(payload, { status: result.created ? 201 : 200 })
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
