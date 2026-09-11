import { NextResponse } from "next/server"

import {
  changeOwnPassword,
  parseWebChangePasswordRequest,
} from "@/lib/auth/change-password.server"
import { getSessionUser } from "@/lib/auth/session"

/**
 * Completes the Web password-change circuit for the signed-in employee.
 * Must remain reachable while must_change_password is true.
 * Target employee is always taken from the session, never from the request body.
 */
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Debe iniciar sesión para cambiar su contraseña.",
      },
      { status: 401 }
    )
  }

  const employeeId = sessionUser.employeeId?.trim() ?? ""
  if (!employeeId) {
    return NextResponse.json(
      {
        success: false,
        phase: "employee",
        error:
          "La contraseña no se pudo asociar a un empleado de la sesión. Contacte al administrador.",
      },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const parsed = parseWebChangePasswordRequest(body)
  if ("error" in parsed) {
    return NextResponse.json(
      { success: false, phase: "validation", error: parsed.error },
      { status: 400 }
    )
  }

  const result = await changeOwnPassword({
    employeeId,
    newPassword: parsed.newPassword,
  })

  if (!result.ok) {
    const status = result.phase === "auth" || result.phase === "validation" ? 400 : 500
    return NextResponse.json(
      {
        success: false,
        phase: result.phase,
        error: result.message,
      },
      { status }
    )
  }

  return NextResponse.json({ success: true })
}
