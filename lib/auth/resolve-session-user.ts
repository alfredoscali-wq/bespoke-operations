import type { User } from "@supabase/supabase-js"

import { parseDniFromAuthEmail } from "@/lib/auth/auth-identity"
import { getMetadataSystemRole } from "@/lib/auth/system-role"
import type { SessionUser } from "@/lib/auth/types"
import { getEmployeeFullName } from "@/lib/employees/utils"
import { buildSessionRoleContext } from "@/lib/roles/session-role"
import { mapRoleCodeToSystemRole } from "@/lib/roles/role-utils"
import type { CompanyRole } from "@/lib/types/company-roles"
import type { Employee } from "@/lib/types/employees"

function resolveSessionDisplayName(
  employee: Pick<Employee, "firstName" | "lastName">
): string {
  return getEmployeeFullName(employee)
}

function resolveSessionInitials(
  employee: Pick<Employee, "firstName" | "lastName">
): string {
  const first = employee.firstName.trim()[0] ?? ""
  const last = employee.lastName.trim()[0] ?? ""
  const initials = `${first}${last}`.toUpperCase()
  return initials || "US"
}

function resolveFallbackDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {}
  const fullName = metadata.full_name

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim()
  }

  const dni = parseDniFromAuthEmail(user.email ?? "")
  if (dni) return `DNI ${dni}`

  return user.email ?? "Usuario"
}

function resolveFallbackInitials(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
  }

  return (parts[0]?.slice(0, 2) ?? "US").toUpperCase()
}

export function buildSessionUserFromAuthUser(
  user: User,
  employee: Employee | null,
  role: CompanyRole | null = null
): SessionUser {
  if (employee) {
    const sessionRole = buildSessionRoleContext({ employee, role })
    const systemRole = role
      ? mapRoleCodeToSystemRole(role.code)
      : employee.systemRole

    return {
      authUserId: user.id,
      employeeId: employee.id,
      companyId: employee.companyId,
      displayName: resolveSessionDisplayName(employee),
      initials: resolveSessionInitials(employee),
      systemRole,
      roleId: sessionRole.roleId,
      roleCode: sessionRole.roleCode,
      roleName: sessionRole.roleName,
      moduleVisibility: sessionRole.moduleVisibility,
      visibleModuleKeys: sessionRole.visibleModuleKeys,
      nationalId: employee.nationalId ?? null,
      mustChangePassword: employee.mustChangePassword,
      email: user.email ?? "",
    }
  }

  const metadata = user.user_metadata ?? {}
  const displayName = resolveFallbackDisplayName(user)
  const sessionRole = buildSessionRoleContext({ employee: null, role: null })

  return {
    authUserId: user.id,
    employeeId:
      typeof metadata.employee_id === "string" ? metadata.employee_id : null,
    companyId: null,
    displayName,
    initials: resolveFallbackInitials(displayName),
    systemRole: getMetadataSystemRole(metadata),
    roleId: null,
    roleCode: null,
    roleName: null,
    moduleVisibility: sessionRole.moduleVisibility,
    visibleModuleKeys: sessionRole.visibleModuleKeys,
    nationalId:
      typeof metadata.national_id === "string"
        ? metadata.national_id
        : parseDniFromAuthEmail(user.email ?? ""),
    mustChangePassword: Boolean(metadata.must_change_password),
    email: user.email ?? "",
  }
}
