import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import type { MobileLoginUser } from "@/lib/mobile/v1/auth/types"

/** Maps authenticated context to the public mobile user profile shape. */
export function mapMobileAuthProfile(auth: MobileAuthContext): MobileLoginUser {
  return {
    id: auth.authUserId,
    name: auth.displayName,
    email: auth.email,
    companyId: auth.companyId,
    employeeId: auth.employeeId,
    role: auth.role,
  }
}
