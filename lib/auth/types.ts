import type { SystemRole } from "@/lib/types/employees"

export type SessionUser = {
  authUserId: string
  employeeId: string | null
  displayName: string
  initials: string
  systemRole: SystemRole | null
  nationalId: string | null
  mustChangePassword: boolean
  email: string
}
