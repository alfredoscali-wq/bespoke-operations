import type { SessionUser } from "@/lib/auth/types"
import type { MobileLoginUser } from "@/lib/mobile/v1/auth/types"
import type { Employee } from "@/lib/types/employees"

export function mapMobileLoginUser(
  sessionUser: SessionUser,
  employee: Employee
): MobileLoginUser {
  return {
    id: sessionUser.authUserId,
    name: sessionUser.displayName,
    email: employee.email?.trim() || sessionUser.email,
    companyId: employee.companyId,
    employeeId: employee.id,
    role: employee.systemRole,
  }
}
