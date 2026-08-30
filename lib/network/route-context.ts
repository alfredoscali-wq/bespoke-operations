import { NextResponse } from "next/server"

import { getSessionUser, type SessionUser } from "@/lib/auth/session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { canAccessNetworkModule } from "@/lib/network/permissions"

export type NetworkRouteContext = {
  ok: true
  sessionUser: SessionUser
  companyId: string
}

export type NetworkRouteContextFailure = {
  ok: false
  response: NextResponse
}

function buildContext(
  sessionUser: SessionUser
): NetworkRouteContext | NetworkRouteContextFailure {
  if (!canAccessNetworkModule(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a Network." },
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

  return { ok: true, sessionUser, companyId }
}

export async function requireNetworkReadContext(): Promise<
  NetworkRouteContext | NetworkRouteContextFailure
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

  return buildContext(sessionUser)
}

export async function requireNetworkWriteContext(): Promise<
  NetworkRouteContext | NetworkRouteContextFailure
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

  return buildContext(auth.sessionUser)
}
