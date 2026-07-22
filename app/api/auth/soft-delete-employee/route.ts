import { NextResponse } from "next/server"

import { softDeleteEmployeeAccess } from "@/lib/auth/soft-delete-employee-access"
import { getSessionUser } from "@/lib/auth/session"

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

  try {
    const result = await softDeleteEmployeeAccess(employeeId)

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
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
