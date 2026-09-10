import { NextResponse } from "next/server"

import {
  jsonFromSessionAuthFailure,
  requireLoadedPasswordCompliantSession,
} from "@/lib/auth/require-password-compliant-session"
import { getSessionUser, type SessionUser } from "@/lib/auth/session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { hasWebModuleAccess } from "@/lib/roles/web-module-access"
import { canWriteSubscriptions } from "@/lib/subscriptions/permissions"

export type SubscriptionsRouteContext = {
  ok: true
  sessionUser: SessionUser
  companyId: string
}

export type SubscriptionsRouteContextFailure = {
  ok: false
  response: NextResponse
}

function buildCompanyContext(
  sessionUser: SessionUser
): SubscriptionsRouteContext | SubscriptionsRouteContextFailure {
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

export async function requireSubscriptionsReadContext(): Promise<
  SubscriptionsRouteContext | SubscriptionsRouteContextFailure
> {
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded
  const sessionUser = loaded.sessionUser
  if (!hasWebModuleAccess(sessionUser, "subscriptions")) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a TV & Suscripciones." },
        { status: 403 }
      ),
    }
  }
  return buildCompanyContext(sessionUser)
}

export async function requireSubscriptionsWriteContext(): Promise<
  SubscriptionsRouteContext | SubscriptionsRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }
  if (!hasWebModuleAccess(auth.sessionUser, "subscriptions")) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a TV & Suscripciones." },
        { status: 403 }
      ),
    }
  }
  if (!canWriteSubscriptions(auth.sessionUser.systemRole)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene permiso para editar planes TV." },
        { status: 403 }
      ),
    }
  }
  return buildCompanyContext(auth.sessionUser)
}
