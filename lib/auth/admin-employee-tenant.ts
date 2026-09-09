/**
 * Tenant isolation for admin Auth operations (provision, reset-password,
 * soft-delete, metadata sync, disable access).
 *
 * Authorization is derived from the administrative session, never from
 * request-body company_id and never from possessing service_role.
 */

export const ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR = "Empleado no encontrado."
export const ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS = 404 as const

export const ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR =
  "Empresa no disponible para la sesión."

const NO_AUTH_SIDE_EFFECTS = {
  createUser: false,
  updateUserById: false,
  patchEmployee: false,
  passwordChanged: false,
  mustChangePasswordChanged: false,
  recordUserCreate: false,
  recordUserProvision: false,
  recordUserPasswordReset: false,
} as const

export type AdminAuthSideEffects = typeof NO_AUTH_SIDE_EFFECTS

export type AdminEmployeeTenantAccess =
  | { ok: true }
  | { ok: false; error: typeof ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR }

export function resolveAdminEmployeeTenantAccess(input: {
  sessionCompanyId: string | null | undefined
  employeeCompanyId: string | null | undefined
  employeeFound: boolean
}): AdminEmployeeTenantAccess {
  const sessionCompanyId = input.sessionCompanyId?.trim() ?? ""
  const employeeCompanyId = input.employeeCompanyId?.trim() ?? ""

  if (
    !input.employeeFound ||
    !sessionCompanyId ||
    !employeeCompanyId ||
    sessionCompanyId !== employeeCompanyId
  ) {
    return { ok: false, error: ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR }
  }

  return { ok: true }
}

export type AdminAuthEmployeeDecision =
  | { allow: true; sessionCompanyId: string }
  | {
      allow: false
      reason:
        | "unauthenticated"
        | "forbidden_role"
        | "missing_session_company"
        | "not_accessible"
      status: 401 | 403 | 404
      error: string
      sideEffects: AdminAuthSideEffects
    }

/**
 * Server-side authorization kernel for admin Auth employee operations.
 *
 * `requestBodyCompanyId` is accepted only so callers/tests can prove it is
 * ignored; it must never authorize the action.
 */
export function decideAdminAuthEmployeeAccess(input: {
  sessionUser: {
    systemRole: string | null
    companyId: string | null
  } | null
  employee: { companyId: string } | null
  requestBodyCompanyId?: string | null
}): AdminAuthEmployeeDecision {
  void input.requestBodyCompanyId

  if (!input.sessionUser) {
    return {
      allow: false,
      reason: "unauthenticated",
      status: 401,
      error: "Debe iniciar sesión para realizar esta acción.",
      sideEffects: NO_AUTH_SIDE_EFFECTS,
    }
  }

  if (input.sessionUser.systemRole !== "administrador") {
    return {
      allow: false,
      reason: "forbidden_role",
      status: 403,
      error: "Solo un administrador puede realizar esta acción.",
      sideEffects: NO_AUTH_SIDE_EFFECTS,
    }
  }

  const sessionCompanyId = input.sessionUser.companyId?.trim() ?? ""
  if (!sessionCompanyId) {
    return {
      allow: false,
      reason: "missing_session_company",
      status: 403,
      error: ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
      sideEffects: NO_AUTH_SIDE_EFFECTS,
    }
  }

  const tenantAccess = resolveAdminEmployeeTenantAccess({
    sessionCompanyId,
    employeeCompanyId: input.employee?.companyId,
    employeeFound: input.employee != null,
  })

  if (!tenantAccess.ok) {
    return {
      allow: false,
      reason: "not_accessible",
      status: ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS,
      error: tenantAccess.error,
      sideEffects: NO_AUTH_SIDE_EFFECTS,
    }
  }

  return { allow: true, sessionCompanyId }
}
