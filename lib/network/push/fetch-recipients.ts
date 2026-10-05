import type { SupabaseClient } from "@supabase/supabase-js"

import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import type { NetworkAlarmPushCandidate } from "@/lib/network/push/recipients"

type TokenRow = {
  company_id: string
  user_id: string
  push_token: string
  enabled: boolean
  deleted_at: string | null
}

type EmployeeRow = {
  id: string
  company_id: string
  system_role: string | null
  role_id: string | null
  deleted_at: string | null
}

type RoleRow = {
  id: string
  company_id: string
  code: string | null
  module_visibility: unknown
}

function asModuleVisibility(
  value: unknown
): Partial<ModuleVisibilityMap> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Partial<ModuleVisibilityMap>
}

export function mapNetworkAlarmPushCandidates(input: {
  tokens: readonly TokenRow[]
  employees: readonly EmployeeRow[]
  roles: readonly RoleRow[]
}): NetworkAlarmPushCandidate[] {
  const employeesById = new Map(
    input.employees.map((employee) => [employee.id, employee])
  )
  const rolesById = new Map(input.roles.map((role) => [role.id, role]))

  return input.tokens.map((token) => {
    const employee = employeesById.get(token.user_id) ?? null
    const role = employee?.role_id ? rolesById.get(employee.role_id) ?? null : null
    return {
      companyId: token.company_id,
      userId: token.user_id,
      pushToken: token.push_token,
      enabled: token.enabled,
      deletedAt: token.deleted_at,
      employeeCompanyId: employee?.company_id ?? null,
      employeeDeletedAt: employee?.deleted_at ?? null,
      systemRole: employee?.system_role ?? null,
      roleCode: role?.code ?? null,
      moduleVisibility: asModuleVisibility(role?.module_visibility),
    }
  })
}

export async function fetchNetworkAlarmPushCandidates(
  client: SupabaseClient,
  alarmCompanyId: string
): Promise<NetworkAlarmPushCandidate[]> {
  const companyId = alarmCompanyId.trim()
  if (!companyId) return []

  const { data: tokenRows, error: tokenError } = await client
    .from("network_push_tokens")
    .select("company_id, user_id, push_token, enabled, deleted_at")
    .eq("company_id", companyId)
    .eq("enabled", true)
    .is("deleted_at", null)

  if (tokenError) {
    throw new Error(tokenError.message)
  }

  const tokens = (tokenRows ?? []) as TokenRow[]
  if (tokens.length === 0) return []

  const userIds = [...new Set(tokens.map((token) => token.user_id))]
  const { data: employeeRows, error: employeeError } = await client
    .from("employees")
    .select("id, company_id, system_role, role_id, deleted_at")
    .eq("company_id", companyId)
    .in("id", userIds)

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  const employees = (employeeRows ?? []) as EmployeeRow[]
  const roleIds = [
    ...new Set(
      employees
        .map((employee) => employee.role_id)
        .filter((roleId): roleId is string => Boolean(roleId))
    ),
  ]

  let roles: RoleRow[] = []
  if (roleIds.length > 0) {
    const { data: roleRows, error: roleError } = await client
      .from("company_roles")
      .select("id, company_id, code, module_visibility")
      .eq("company_id", companyId)
      .in("id", roleIds)
    if (roleError) {
      throw new Error(roleError.message)
    }
    roles = (roleRows ?? []) as RoleRow[]
  }

  return mapNetworkAlarmPushCandidates({
    tokens,
    employees,
    roles,
  })
}
