import { NextResponse } from "next/server"

import {
  jsonFromSessionAuthFailure,
  requireLoadedPasswordCompliantSession,
} from "@/lib/auth/require-password-compliant-session"
import { getSessionUser, type SessionUser } from "@/lib/auth/session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import {
  canAccessIspBilling,
  canAccessIspMigration,
  canAccessIspModule,
  canReadIspCatalogForOt,
  canRemoveIspSubscriber,
} from "@/lib/isp/permissions"
import { ISP_BILLING_DOCUMENT_DELETE_FORBIDDEN, ISP_BILLING_FORBIDDEN_MESSAGE } from "@/lib/isp/billing-constants"
import { ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE } from "@/lib/isp/subscriber-removal"
import { isAdministradorSessionUser } from "@/lib/roles/web-module-access"

export type IspRouteContext = {
  ok: true
  sessionUser: SessionUser
  companyId: string
}

export type IspRouteContextFailure = {
  ok: false
  response: NextResponse
}

function buildContext(
  sessionUser: SessionUser
): IspRouteContext | IspRouteContextFailure {
  if (!canAccessIspModule(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a Clientes 360°." },
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

function buildCompanyContext(
  sessionUser: SessionUser
): IspRouteContext | IspRouteContextFailure {
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

export async function requireIspReadContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded
  return buildContext(loaded.sessionUser)
}

export async function requireIspWriteContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }

  return buildContext(auth.sessionUser)
}

export async function requireIspSubscriberRemovalContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth

  if (!canRemoveIspSubscriber(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE },
        { status: 403 }
      ),
    }
  }

  return auth
}

export async function requireIspCatalogOtReadContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded
  const sessionUser = loaded.sessionUser

  if (!canReadIspCatalogForOt(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso al catálogo de servicios." },
        { status: 403 }
      ),
    }
  }

  return buildCompanyContext(sessionUser)
}

export async function requireIspMigrationReadContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded
  const sessionUser = loaded.sessionUser

  if (!canAccessIspMigration(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a la migración de abonados." },
        { status: 403 }
      ),
    }
  }

  return buildCompanyContext(sessionUser)
}

export async function requireIspMigrationWriteContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }

  if (!canAccessIspMigration(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "No tiene acceso a la migración de abonados." },
        { status: 403 }
      ),
    }
  }

  return buildCompanyContext(auth.sessionUser)
}

export async function requireIspBillingReadContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const loaded = requireLoadedPasswordCompliantSession(await getSessionUser())
  if (!loaded.ok) return loaded
  const sessionUser = loaded.sessionUser

  if (!canAccessIspBilling(sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: ISP_BILLING_FORBIDDEN_MESSAGE },
        { status: 403 }
      ),
    }
  }

  return buildCompanyContext(sessionUser)
}

export async function requireIspBillingWriteContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }

  if (!canAccessIspBilling(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: ISP_BILLING_FORBIDDEN_MESSAGE },
        { status: 403 }
      ),
    }
  }

  return buildCompanyContext(auth.sessionUser)
}

export async function requireIspBillingAdminContext(): Promise<
  IspRouteContext | IspRouteContextFailure
> {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return { ok: false, response: jsonFromSessionAuthFailure(auth) }
  }

  if (!canAccessIspBilling(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: ISP_BILLING_FORBIDDEN_MESSAGE },
        { status: 403 }
      ),
    }
  }

  if (!isAdministradorSessionUser(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: ISP_BILLING_DOCUMENT_DELETE_FORBIDDEN,
        },
        { status: 403 }
      ),
    }
  }

  return buildCompanyContext(auth.sessionUser)
}
