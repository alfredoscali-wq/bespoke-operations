import { NextResponse } from "next/server"

import { extractRequestAuditContext } from "@/lib/audit/request-context"
import {
  recordUserLoginAudit,
  recordUserLogoutAudit,
} from "@/lib/audit/users-audit.server"
import { AUDIT_ACTIONS } from "@/lib/audit/types"
import { getSessionUser } from "@/lib/auth/session"

type AuditSessionBody = {
  action?: string
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, error: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  let body: AuditSessionBody

  try {
    body = (await request.json()) as AuditSessionBody
  } catch {
    return NextResponse.json(
      { success: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const action = body.action?.trim()

  if (
    action !== AUDIT_ACTIONS.USER_LOGIN &&
    action !== AUDIT_ACTIONS.USER_LOGOUT
  ) {
    return NextResponse.json(
      { success: false, error: "Acción de sesión inválida." },
      { status: 400 }
    )
  }

  const requestContext = extractRequestAuditContext(request)

  try {
    if (action === AUDIT_ACTIONS.USER_LOGIN) {
      await recordUserLoginAudit(sessionUser, requestContext)
    } else {
      await recordUserLogoutAudit(sessionUser, requestContext)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo registrar el evento de sesión."

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
