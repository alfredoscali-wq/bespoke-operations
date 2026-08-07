/**
 * Sprint 32.0 — lightweight auth context for release-expired-managements.
 * Uses auth.getUser + JWT user_metadata only (no employees / company_roles).
 */

import "server-only"

import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth/get-auth-user.server"
import {
  getMetadataRoleId,
  getMetadataSystemRoleFromUser,
} from "@/lib/auth/module-access"
import { DEMO_RESTRICTED_DIALOG_MESSAGE } from "@/lib/demo/constants"
import { isDemoPlatformReadOnlyUser } from "@/lib/demo/demo-mode"
import { hasWebModuleAccessFromMetadata } from "@/lib/roles/web-module-access"
import {
  addReleaseExpiredTimer,
  getReleaseExpiredStore,
  recordReleaseExpiredCall,
  recordReleaseExpiredQuery,
} from "@/lib/customer-service/performance/release-expired-breakdown"
import type { SystemRole } from "@/lib/types/employees"

export type ReleaseExpiredAuthContext = {
  userId: string
  companyId: string
  employeeId: string | null
  roleId: string | null
}

type ReleaseExpiredAuthLoad = {
  userId: string
  companyId: string | null
  employeeId: string | null
  roleId: string | null
  systemRole: SystemRole | null
  metadata: Record<string, unknown>
}

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string
): string | null {
  const value = metadata[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function markAuthTimers(wallStarted: number): void {
  if (!getReleaseExpiredStore()) return
  addReleaseExpiredTimer("sessionUserMs", nowMs() - wallStarted)
  // Sprint 32.0 — DB lookups eliminated; record 0 for comparison vs Sprint 31.
  addReleaseExpiredTimer("employeeMs", 0)
  addReleaseExpiredTimer("roleMs", 0)
}

async function loadReleaseExpiredAuthFromJwt(): Promise<ReleaseExpiredAuthLoad | null> {
  const releaseExpired = getReleaseExpiredStore()
  const wallStarted = nowMs()

  recordReleaseExpiredCall("getUser()")
  // Sprint 33.0 — reuse middleware-validated JWT when present (cache hit).
  const authLookup = await getAuthUser()
  if (releaseExpired) {
    recordReleaseExpiredQuery("auth.getUser", authLookup.durationMs, {
      cached: authLookup.fromCache,
    })
  }

  const user = authLookup.user
  const error = authLookup.error

  if (error || !user) {
    markAuthTimers(wallStarted)
    return null
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const companyId = readMetadataString(metadata, "company_id")
  const employeeId = readMetadataString(metadata, "employee_id")
  const roleId =
    getMetadataRoleId(metadata) ?? readMetadataString(metadata, "role_id")
  const systemRole = getMetadataSystemRoleFromUser(metadata)

  markAuthTimers(wallStarted)

  return {
    userId: user.id,
    companyId,
    employeeId,
    roleId,
    systemRole,
    metadata,
  }
}

/**
 * Auth + JWT metadata only. Does not query employees or company_roles.
 * Returns null when unauthenticated or company_id is missing from metadata.
 */
export async function getReleaseExpiredAuthContext(): Promise<ReleaseExpiredAuthContext | null> {
  const loaded = await loadReleaseExpiredAuthFromJwt()
  if (!loaded?.companyId) {
    return null
  }

  return {
    userId: loaded.userId,
    companyId: loaded.companyId,
    employeeId: loaded.employeeId,
    roleId: loaded.roleId,
  }
}

/**
 * Same validations / messages as requireAtencionClienteMutationContext,
 * resolved from JWT metadata instead of a full SessionUser load.
 */
export async function requireReleaseExpiredAuthContext(): Promise<
  | {
      ok: true
      companyId: string
      employeeId: string
      context: ReleaseExpiredAuthContext
    }
  | { ok: false; response: NextResponse }
> {
  const loaded = await loadReleaseExpiredAuthFromJwt()

  if (!loaded) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Debe iniciar sesión para realizar esta acción.",
        },
        { status: 401 }
      ),
    }
  }

  if (
    isDemoPlatformReadOnlyUser({
      systemRole: loaded.systemRole,
      companyId: loaded.companyId,
    })
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: DEMO_RESTRICTED_DIALOG_MESSAGE },
        { status: 403 }
      ),
    }
  }

  if (
    !hasWebModuleAccessFromMetadata(
      loaded.metadata,
      "atencion_cliente",
      loaded.systemRole
    )
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No tiene permiso para operar Atención al Cliente.",
        },
        { status: 403 }
      ),
    }
  }

  if (!loaded.companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No se pudo resolver la compañía del usuario.",
        },
        { status: 403 }
      ),
    }
  }

  if (!loaded.employeeId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No se pudo identificar al empleado autenticado.",
        },
        { status: 403 }
      ),
    }
  }

  const context: ReleaseExpiredAuthContext = {
    userId: loaded.userId,
    companyId: loaded.companyId,
    employeeId: loaded.employeeId,
    roleId: loaded.roleId,
  }

  return {
    ok: true,
    companyId: loaded.companyId,
    employeeId: loaded.employeeId,
    context,
  }
}
