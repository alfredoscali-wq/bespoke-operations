import type { RecordActivityInput } from "@/lib/activity/activity-types"
import type { SessionUser } from "@/lib/auth/types"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"

export type ActivityActorContext = Pick<
  RecordActivityInput,
  "companyId" | "employeeId" | "appUserId"
>

export function activityActorFromSession(
  sessionUser: SessionUser
): ActivityActorContext | null {
  const companyId = sessionUser.companyId?.trim() ?? ""
  if (!companyId) return null

  return {
    companyId,
    employeeId: sessionUser.employeeId?.trim() || null,
    appUserId: sessionUser.authUserId?.trim() || null,
  }
}

export function activityActorFromMobile(
  auth: MobileAuthContext
): ActivityActorContext {
  return {
    companyId: auth.companyId,
    employeeId: auth.employeeId,
    appUserId: auth.authUserId,
  }
}

export function withActivityActor(
  actor: ActivityActorContext,
  event: Omit<RecordActivityInput, "companyId" | "employeeId" | "appUserId">
): RecordActivityInput {
  return {
    ...actor,
    ...event,
  }
}
