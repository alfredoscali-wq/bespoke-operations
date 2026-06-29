import type { SessionUser } from "@/lib/auth/types"
import type { SystemRole } from "@/lib/types/employees"
import type { Employee } from "@/lib/types/employees"

export type MobileAuthContext = {
  authUserId: string
  employeeId: string
  companyId: string
  role: SystemRole
  email: string
  displayName: string
}

export function buildMobileAuthContext(
  sessionUser: SessionUser,
  employee: Employee
): MobileAuthContext {
  return {
    authUserId: sessionUser.authUserId,
    employeeId: employee.id,
    companyId: employee.companyId,
    role: employee.systemRole,
    email: employee.email?.trim() || sessionUser.email,
    displayName: sessionUser.displayName,
  }
}
