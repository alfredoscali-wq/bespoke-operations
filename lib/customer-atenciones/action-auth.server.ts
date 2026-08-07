/**
 * Sprint 38.0 — lightweight JWT auth context for ATC management actions.
 * Pattern from Sprint 32.0 (release-expired): auth.getUser + user_metadata only.
 * No SessionUser / employees / company_roles.
 *
 * Sprint 41.0 — getAuthUser() reuses the proxy-validated signed cache header
 * (no second auth.getUser network round-trip when proxy already ran).
 *
 * Sprint 44.0 — if JWT metadata lacks company_id/employee_id, resolve once from
 * employees by app_user_id (same source as RLS auth_user_company_id). Prevents
 * CONSULTATION_NOT_FOUND when the UI loads via employees.company_id but start
 * used a missing/stale JWT company_id.
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
  getAtcActionStore,
  recordAtcActionCall,
  recordAtcActionQuery,
} from "@/lib/customer-service/performance/action-breakdown"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchEmployeeByAppUserId } from "@/lib/supabase/employees.queries"
import type { SystemRole } from "@/lib/types/employees"

export type CustomerActionAuthContext = {
  userId: string
  companyId: string
  employeeId: string | null
  roleId: string | null
}

type CustomerActionAuthLoad = {
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

async function resolveActorFromEmployees(appUserId: string): Promise<{
  companyId: string | null
  employeeId: string | null
  durationMs: number
}> {
  const started = nowMs()
  const admin = createAdminClient()
  const result = await fetchEmployeeByAppUserId(admin, appUserId)
  return {
    companyId: result.data?.companyId ?? null,
    employeeId: result.data?.id ?? null,
    durationMs: nowMs() - started,
  }
}

async function loadCustomerActionAuthFromJwt(): Promise<CustomerActionAuthLoad | null> {
  const atcAction = getAtcActionStore()

  recordAtcActionCall("getUser()")
  // Sprint 33.0 — reuse middleware-validated JWT when present (cache hit).
  const authLookup = await getAuthUser()
  if (atcAction) {
    recordAtcActionQuery("auth.getUser", authLookup.durationMs, {
      cached: authLookup.fromCache,
    })
    recordAtcActionQuery("company_roles", 0)
  }

  const user = authLookup.user
  const error = authLookup.error

  if (error || !user) {
    if (atcAction) {
      recordAtcActionQuery("employees", 0)
    }
    return null
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  let companyId = readMetadataString(metadata, "company_id")
  let employeeId = readMetadataString(metadata, "employee_id")
  const roleId =
    getMetadataRoleId(metadata) ?? readMetadataString(metadata, "role_id")
  const systemRole = getMetadataSystemRoleFromUser(metadata)

  // Sprint 44.0 — fill gaps from employees (RLS source of truth). Skip when JWT complete.
  if (!companyId || !employeeId) {
    recordAtcActionCall("employees.byAppUserId")
    const resolved = await resolveActorFromEmployees(user.id)
    if (atcAction) {
      recordAtcActionQuery("employees", resolved.durationMs)
    }
    companyId = companyId ?? resolved.companyId
    employeeId = employeeId ?? resolved.employeeId
  } else if (atcAction) {
    recordAtcActionQuery("employees", 0, { cached: true })
  }

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
 * Auth + JWT metadata, with Sprint 44 employees fallback when metadata is incomplete.
 * Returns null when unauthenticated or company_id cannot be resolved.
 */
export async function getCustomerActionAuthContext(): Promise<CustomerActionAuthContext | null> {
  const loaded = await loadCustomerActionAuthFromJwt()
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
export async function requireCustomerActionAuthContext(): Promise<
  | {
      ok: true
      companyId: string
      employeeId: string
      context: CustomerActionAuthContext
    }
  | { ok: false; response: NextResponse }
> {
  const loaded = await loadCustomerActionAuthFromJwt()

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

  const context: CustomerActionAuthContext = {
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
