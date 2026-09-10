import { NextResponse } from "next/server"

import {
  jsonFromSessionAuthFailure,
  requireLoadedPasswordCompliantSession,
} from "@/lib/auth/require-password-compliant-session"
import { getSessionUser, type SessionUser } from "@/lib/auth/session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import {
  canAccessGestionComercialModule,
  resolveCommercialActorEmployeeId,
} from "@/lib/commercial/module-access"

export type CommercialRouteContext = {
  ok: true
  sessionUser: SessionUser
  companyId: string
  employeeId: string | null
}

export type CommercialRouteContextFailure = {
  ok: false
  response: NextResponse
}

function buildCompanyContext(
  sessionUser: SessionUser
): CommercialRouteContext | CommercialRouteContextFailure {
  if (!canAccessGestionComercialModule(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a Gestión Comercial." },
        { status: 403 }
      ),
    }
  }

  const companyId = sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Empresa no resuelta para la sesión." },
        { status: 400 }
      ),
    }
  }

  return {
    ok: true,
    sessionUser,
    companyId,
    employeeId: resolveCommercialActorEmployeeId(sessionUser),
  }
}

export async function requireGestionComercialReadContext(): Promise<
  CommercialRouteContext | CommercialRouteContextFailure
> {
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded

  return buildCompanyContext(loaded.sessionUser)
}

export async function requireGestionComercialMutationContext(): Promise<
  CommercialRouteContext | CommercialRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }

  return buildCompanyContext(auth.sessionUser)
}
