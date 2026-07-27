import { NextResponse } from "next/server"

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
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Debe iniciar sesión." },
        { status: 401 }
      ),
    }
  }

  return buildCompanyContext(sessionUser)
}

export async function requireGestionComercialMutationContext(): Promise<
  CommercialRouteContext | CommercialRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status }
      ),
    }
  }

  return buildCompanyContext(auth.sessionUser)
}
