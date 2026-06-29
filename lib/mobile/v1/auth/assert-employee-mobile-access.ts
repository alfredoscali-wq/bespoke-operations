import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"

export function assertEmployeeCanUseMobile(employee: {
  systemAccess: boolean
  employmentStatus: string
}): void {
  if (!employee.systemAccess) {
    throw new MobileApiError(
      "USER_DISABLED",
      MOBILE_API_ERROR_MESSAGES.USER_DISABLED,
      403
    )
  }

  if (
    employee.employmentStatus === "inactive" ||
    employee.employmentStatus === "suspended"
  ) {
    throw new MobileApiError(
      "USER_DISABLED",
      MOBILE_API_ERROR_MESSAGES.USER_DISABLED,
      403
    )
  }
}
