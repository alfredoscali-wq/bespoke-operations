import { NextResponse } from "next/server"

import {
  jsonFromSessionAuthFailure,
  requireLoadedPasswordCompliantSession,
} from "@/lib/auth/require-password-compliant-session"
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
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded

  return buildContext(loaded.sessionUser)
}

export async function requireNetworkWriteContext(): Promise<
  NetworkRouteContext | NetworkRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }

  return buildContext(auth.sessionUser)
}
