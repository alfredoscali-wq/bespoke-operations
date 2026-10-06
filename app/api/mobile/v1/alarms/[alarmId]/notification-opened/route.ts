import { handleProtectedMobileRoute } from "@/lib/mobile/v1/handle-mobile-route"
import {
  requireAuthenticatedUser,
  requireEmployee,
} from "@/lib/mobile/v1/auth/mobile-auth-helpers"
import { assertCanReadMobileNetworkAlarms } from "@/lib/mobile/v1/alarms/can-read-mobile-network-alarms"
import { mobileApiErrorResponse } from "@/lib/mobile/v1/error-factory"
import { mobileApiSuccessResponse } from "@/lib/mobile/v1/response-factory"
import { markNetworkAlarmNotificationOpened } from "@/lib/network/push/persist-notifications"
import { createAdminClient } from "@/lib/supabase/admin"

type RouteContext = {
  params: Promise<{ alarmId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedMobileRoute(request, async (mobileContext) => {
    const auth = requireAuthenticatedUser(mobileContext)
    requireEmployee(auth)
    assertCanReadMobileNetworkAlarms(auth.role)

    // Tenant and employee exclusively from the session. Ignore any body fields.
    void (await request.json().catch(() => null))

    const { alarmId } = await context.params
    const trimmedAlarmId = alarmId.trim()
    if (!trimmedAlarmId) {
      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "Alarma inválida.",
        400
      )
    }

    const client = createAdminClient()
    const notification = await markNetworkAlarmNotificationOpened(client, {
      companyId: auth.companyId,
      employeeId: auth.employeeId,
      alarmId: trimmedAlarmId,
    })
    if (!notification) {
      return mobileApiErrorResponse(
        mobileContext.request,
        "INVALID_REQUEST",
        "No hay notificación de alarma para este usuario.",
        404
      )
    }

    return mobileApiSuccessResponse(mobileContext.request, {
      alarmId: notification.alarmId,
      openedAt: notification.openedAt,
    })
  })
}
