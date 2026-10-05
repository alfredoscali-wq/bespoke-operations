import type { SystemRole } from "@/lib/types/employees"
import { MobileApiError } from "@/lib/mobile/v1/errors"

/**
 * Field Agent / Operario and Mobile Técnica may read company alarms.
 * Commercial Mobile (`administrativo`) is authenticated Mobile but not
 * eligible for this Network Alarms catalog.
 *
 * This is independent from web `moduleVisibility.network`.
 */
const MOBILE_NETWORK_ALARM_ROLES: ReadonlySet<SystemRole> = new Set([
  "operario",
  "supervisor",
  "administrador",
  "demo",
])

export const MOBILE_NETWORK_ALARMS_FORBIDDEN_MESSAGE =
  "No tiene acceso a Alarmas desde Field Agent."

export function canReadMobileNetworkAlarms(role: SystemRole): boolean {
  return MOBILE_NETWORK_ALARM_ROLES.has(role)
}

export function assertCanReadMobileNetworkAlarms(role: SystemRole): void {
  if (!canReadMobileNetworkAlarms(role)) {
    throw new MobileApiError(
      "FORBIDDEN",
      MOBILE_NETWORK_ALARMS_FORBIDDEN_MESSAGE,
      403
    )
  }
}

export function resolveMobileNetworkAlarmsCompanyId(
  sessionCompanyId: string,
  requestedCompanyId?: string | null
): string {
  void requestedCompanyId
  const companyId = sessionCompanyId.trim()
  if (!companyId) {
    throw new MobileApiError(
      "EMPLOYEE_NOT_FOUND",
      "Empresa no disponible para el usuario autenticado.",
      404
    )
  }
  return companyId
}
