import type { AppModuleKey } from "@/lib/roles/app-modules"
import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import type { SystemRole } from "@/lib/types/employees"

export type SessionUser = {
  authUserId: string
  employeeId: string | null
  companyId: string | null
  displayName: string
  initials: string
  systemRole: SystemRole | null
  roleId: string | null
  roleCode: string | null
  roleName: string | null
  moduleVisibility: ModuleVisibilityMap
  visibleModuleKeys: AppModuleKey[]
  nationalId: string | null
  mustChangePassword: boolean
  email: string
}
