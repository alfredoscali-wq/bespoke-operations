import "server-only"

import { NextResponse } from "next/server"

import { jsonFromSessionAuthFailure } from "@/lib/auth/require-password-compliant-session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { getSessionUser } from "@/lib/auth/session"
import {
  canManageMikrotikIntegrations,
  resolveSessionCompanyId,
} from "@/lib/integrations/mikrotik/access"
import type { SessionUser } from "@/lib/auth/types"

export type MikrotikSessionOk = {
  ok: true
  sessionUser: SessionUser
  companyId: string
}

export type MikrotikSessionErr = {
  ok: false
  response: NextResponse
}

export async function requireMikrotikReadSession(): Promise<
  MikrotikSessionOk | MikrotikSessionErr
> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Debe iniciar sesion." },
        { status: 401 }
      ),
    }
  }

  if (!canManageMikrotikIntegrations(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No tiene permiso para administrar integraciones MikroTik.",
        },
        { status: 403 }
      ),
    }
  }

  const companyId = resolveSessionCompanyId(sessionUser)
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Empresa no resuelta para la sesion." },
        { status: 400 }
      ),
    }
  }

  return { ok: true, sessionUser, companyId }
}

export async function requireMikrotikWriteSession(): Promise<
  MikrotikSessionOk | MikrotikSessionErr
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }

  if (!canManageMikrotikIntegrations(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No tiene permiso para administrar integraciones MikroTik.",
        },
        { status: 403 }
      ),
    }
  }

  const companyId = resolveSessionCompanyId(auth.sessionUser)
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Empresa no resuelta para la sesion." },
        { status: 400 }
      ),
    }
  }

  return { ok: true, sessionUser: auth.sessionUser, companyId }
}
