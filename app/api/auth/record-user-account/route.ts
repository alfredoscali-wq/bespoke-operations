import { NextResponse } from "next/server"

import { recordUserAccountChangesAudit } from "@/lib/audit/users-audit.server"
import { hasUserAccountFieldChanges } from "@/lib/audit/users-audit"
import type { Employee, UpdateEmployeeInput } from "@/lib/types/employees"
import { getSessionUser } from "@/lib/auth/session"

type RecordUserAccountBody = {
  before?: Employee
  after?: Employee
  changes?: UpdateEmployeeInput
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, error: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  if (sessionUser.systemRole !== "administrador") {
    return NextResponse.json(
      {
        success: false,
        error: "Solo un administrador puede registrar cambios de cuenta.",
      },
      { status: 403 }
    )
  }

  let body: RecordUserAccountBody

  try {
    body = (await request.json()) as RecordUserAccountBody
  } catch {
    return NextResponse.json(
      { success: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const { before, after, changes } = body

  if (!before || !after || !changes) {
    return NextResponse.json(
      { success: false, error: "before, after y changes son obligatorios." },
      { status: 400 }
    )
  }

  if (before.id !== after.id) {
    return NextResponse.json(
      { success: false, error: "Los registros before/after no coinciden." },
      { status: 400 }
    )
  }

  if (!hasUserAccountFieldChanges(changes)) {
    return NextResponse.json({ success: true, skipped: true })
  }

  try {
    await recordUserAccountChangesAudit({
      performedBy: sessionUser,
      before,
      after,
      changes,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo registrar el cambio de cuenta."

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
