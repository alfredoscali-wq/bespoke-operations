import { NextResponse } from "next/server"

import { provisionEmployeeAccess } from "@/lib/auth/provision-employee"
import { getSessionUser } from "@/lib/auth/session"

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
    const result = await provisionEmployeeAccess(employeeId)

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
    }

    return NextResponse.json(result, { status: 201 })
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
