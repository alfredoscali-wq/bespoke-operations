import { NextResponse } from "next/server"

import {
  jsonFromSessionAuthFailure,
  requireLoadedPasswordCompliantSession,
} from "@/lib/auth/require-password-compliant-session"
import { getSessionUser, type SessionUser } from "@/lib/auth/session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { canAccessMaterialsModule } from "@/lib/materials/permissions"
import { hasWebModuleAccess } from "@/lib/roles/web-module-access"

export type TaskMaterialLinesRouteContext = {
  ok: true
  sessionUser: SessionUser
  companyId: string
}

export type TaskMaterialLinesRouteContextFailure = {
  ok: false
  response: NextResponse
}

function canAccessTaskMaterialLines(sessionUser: SessionUser): boolean {
  return (
    canAccessMaterialsModule(sessionUser) ||
    hasWebModuleAccess(sessionUser, "work_orders")
  )
}

function buildContext(
  sessionUser: SessionUser
): TaskMaterialLinesRouteContext | TaskMaterialLinesRouteContextFailure {
  if (!canAccessTaskMaterialLines(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No tiene acceso para gestionar materiales de OT.",
        },
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

export async function requireTaskMaterialLinesReadContext(): Promise<
  TaskMaterialLinesRouteContext | TaskMaterialLinesRouteContextFailure
> {
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded
  return buildContext(loaded.sessionUser)
}

export async function requireTaskMaterialLinesMutationContext(): Promise<
  TaskMaterialLinesRouteContext | TaskMaterialLinesRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }
  return buildContext(auth.sessionUser)
}
