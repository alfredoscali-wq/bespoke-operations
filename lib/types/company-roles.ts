import type { AppModuleKey, ModuleVisibilityMap } from "@/lib/roles/app-modules"

export type CompanyRole = {
  id: string
  companyId: string
  code: string
  name: string
  isSystem: boolean
  moduleVisibility: ModuleVisibilityMap
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CompanyRoleInput = {
  name: string
  moduleVisibility: ModuleVisibilityMap
}

export type CreateCompanyRoleInput = CompanyRoleInput & {
  copyFromRoleId: string
}

export type UpdateCompanyRoleModulesInput = {
  moduleVisibility: ModuleVisibilityMap
}

export type CompanyRoleSummary = Pick<
  CompanyRole,
  "id" | "code" | "name" | "isSystem"
>

export type SessionRoleContext = {
  roleId: string | null
  roleCode: string | null
  roleName: string | null
  moduleVisibility: ModuleVisibilityMap
  visibleModuleKeys: AppModuleKey[]
}
