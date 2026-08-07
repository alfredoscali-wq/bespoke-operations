import "server-only"

import { getAuthUser } from "@/lib/auth/get-auth-user.server"
import { buildSessionUserFromAuthUser } from "@/lib/auth/resolve-session-user"
import type { AuthSyncContext } from "@/lib/auth/sync-employee-auth-metadata"
import type { SessionUser } from "@/lib/auth/types"
import {
  addAuthSyncTimer,
  getAuthSyncStore,
  recordAuthSyncCall,
  recordAuthSyncQuery,
} from "@/lib/auth/performance/auth-sync-profiler"
import { nowMs } from "@/lib/auth/performance/enabled"
import {
  addReleaseExpiredTimer,
  getReleaseExpiredStore,
  recordReleaseExpiredCall,
  recordReleaseExpiredQuery,
} from "@/lib/customer-service/performance/release-expired-breakdown"
import {
  getAtcActionStore,
  recordAtcActionCall,
  recordAtcActionQuery,
} from "@/lib/customer-service/performance/action-breakdown"
import { fetchCompanyRoleById } from "@/lib/supabase/company-roles.queries"
import { fetchEmployeeByAppUserId } from "@/lib/supabase/employees.queries"
import { createClient } from "@/lib/supabase/server"
import type { CompanyRole } from "@/lib/types/company-roles"
import type { Employee } from "@/lib/types/employees"
import type { User } from "@supabase/supabase-js"

export type { SessionUser } from "@/lib/auth/types"

export type SessionUserLoadResult = {
  sessionUser: SessionUser
  authUser: User
  employee: Employee | null
  role: CompanyRole | null
}

async function loadSessionUserParts(): Promise<SessionUserLoadResult | null> {
  const authSync = getAuthSyncStore()
  const releaseExpired = getReleaseExpiredStore()
  const atcAction = getAtcActionStore()
  const supabase = await createClient()

  const sessionWallStarted = nowMs()

  recordAuthSyncCall("getUser()")
  recordReleaseExpiredCall("getUser()")
  recordAtcActionCall("getUser()")
  const authLookup = await getAuthUser()
  const userDuration = authLookup.durationMs
  if (authSync) {
    addAuthSyncTimer("userMs", userDuration)
    recordAuthSyncQuery("auth.getUser", userDuration)
  }
  if (releaseExpired) {
    recordReleaseExpiredQuery("auth.getUser", userDuration, {
      cached: authLookup.fromCache,
    })
  }
  if (atcAction) {
    recordAtcActionQuery("auth.getUser", userDuration, {
      cached: authLookup.fromCache,
    })
  }

  const user = authLookup.user
  const error = authLookup.error

  if (error || !user) {
    if (releaseExpired) {
      addReleaseExpiredTimer("sessionUserMs", nowMs() - sessionWallStarted)
    }
    return null
  }

  recordAuthSyncCall("employee lookup")
  recordReleaseExpiredCall("employee lookup")
  recordAtcActionCall("employee lookup")
  const employeeStarted = nowMs()
  const employeeResult = await fetchEmployeeByAppUserId(supabase, user.id)
  const employeeDuration = nowMs() - employeeStarted
  if (authSync) {
    addAuthSyncTimer("employeeMs", employeeDuration)
    recordAuthSyncQuery("employees", employeeDuration)
  }
  if (releaseExpired) {
    addReleaseExpiredTimer("employeeMs", employeeDuration)
    recordReleaseExpiredQuery("employees", employeeDuration)
  }
  if (atcAction) {
    recordAtcActionQuery("employees", employeeDuration)
  }
  const employee = employeeResult.data ?? null

  if (!employee?.roleId) {
    if (releaseExpired) {
      addReleaseExpiredTimer("sessionUserMs", nowMs() - sessionWallStarted)
    }
    return {
      authUser: user,
      employee,
      role: null,
      sessionUser: buildSessionUserFromAuthUser(user, employee, null),
    }
  }

  recordAuthSyncCall("role lookup")
  recordReleaseExpiredCall("role lookup")
  recordAtcActionCall("role lookup")
  const roleStarted = nowMs()
  const roleResult = await fetchCompanyRoleById(supabase, employee.roleId)
  const roleDuration = nowMs() - roleStarted
  if (authSync) {
    addAuthSyncTimer("roleMs", roleDuration)
    recordAuthSyncQuery("company_roles", roleDuration)
  }
  if (releaseExpired) {
    addReleaseExpiredTimer("roleMs", roleDuration)
    recordReleaseExpiredQuery("company_roles", roleDuration)
  }
  if (atcAction) {
    recordAtcActionQuery("company_roles", roleDuration)
  }
  const role = roleResult.data ?? null

  if (releaseExpired) {
    addReleaseExpiredTimer("sessionUserMs", nowMs() - sessionWallStarted)
  }

  return {
    authUser: user,
    employee,
    role,
    sessionUser: buildSessionUserFromAuthUser(user, employee, role),
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const loaded = await loadSessionUserParts()
  return loaded?.sessionUser ?? null
}

/**
 * Sprint 30.0 — session user plus employee/role rows for metadata sync reuse.
 */
export async function getSessionUserWithAuthSyncContext(): Promise<{
  sessionUser: SessionUser
  context: AuthSyncContext
} | null> {
  const loaded = await loadSessionUserParts()
  if (!loaded?.employee) {
    return null
  }

  return {
    sessionUser: loaded.sessionUser,
    context: {
      userId: loaded.employee.appUserId ?? loaded.authUser.id,
      employee: loaded.employee,
      role: loaded.role,
    },
  }
}
