import { NextResponse } from "next/server"

import { getSessionUser, type SessionUser } from "@/lib/auth/session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { canAccessMaterialsModule } from "@/lib/materials/permissions"

export type MaterialsRouteContext = {
  ok: true
  sessionUser: SessionUser
  companyId: string
  employeeId: string | null
}

export type MaterialsRouteContextFailure = {
  ok: false
  response: NextResponse
}

function buildCompanyContext(
  sessionUser: SessionUser
): MaterialsRouteContext | MaterialsRouteContextFailure {
  if (!canAccessMaterialsModule(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a Materiales." },
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
    employeeId: sessionUser.employeeId?.trim() || null,
  }
}

export async function requireMaterialsReadContext(): Promise<
  MaterialsRouteContext | MaterialsRouteContextFailure
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

export async function requireMaterialsMutationContext(): Promise<
  MaterialsRouteContext | MaterialsRouteContextFailure
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
