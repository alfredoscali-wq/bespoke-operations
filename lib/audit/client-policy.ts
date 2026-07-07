import {
  isAuditAction,
  resolveAuditSeverity,
} from "@/lib/audit/audit-catalog"
import { AUDIT_ACTIONS, AUDIT_SEVERITIES, type AuditAction } from "@/lib/audit/types"

/** Acciones que solo pueden registrarse server-side (nunca vía POST del cliente). */
export const SERVER_ONLY_AUDIT_ACTIONS = new Set<AuditAction>([
  AUDIT_ACTIONS.CUSTOMER_DELETE_PERMANENT,
  AUDIT_ACTIONS.TASK_DELETE_PERMANENT,
  AUDIT_ACTIONS.PROJECT_DELETE_PERMANENT,
  AUDIT_ACTIONS.USER_LOGIN,
  AUDIT_ACTIONS.USER_LOGOUT,
  AUDIT_ACTIONS.USER_CREATE,
  AUDIT_ACTIONS.USER_PROVISION,
  AUDIT_ACTIONS.USER_PASSWORD_RESET,
  AUDIT_ACTIONS.USER_ROLE_CHANGE,
  AUDIT_ACTIONS.USER_DEACTIVATE,
  AUDIT_ACTIONS.USER_REACTIVATE,
  AUDIT_ACTIONS.INCIDENT_CREATED,
  AUDIT_ACTIONS.INCIDENT_SUPERVISOR_ACTION,
  AUDIT_ACTIONS.INCIDENT_CLOSED,
])

export function isServerOnlyAuditAction(action: AuditAction): boolean {
  return SERVER_ONLY_AUDIT_ACTIONS.has(action)
}

export function isClientWritableAuditAction(action: string): action is AuditAction {
  if (!isAuditAction(action)) {
    return false
  }

  if (isServerOnlyAuditAction(action)) {
    return false
  }

  return resolveAuditSeverity(action) !== AUDIT_SEVERITIES.CRITICAL
}

export function getClientAuditRejectionMessage(action: string): string {
  if (!isAuditAction(action)) {
    return "Acción de auditoría inválida."
  }

  if (isServerOnlyAuditAction(action)) {
    return "Esta acción solo puede registrarse desde el servidor."
  }

  if (resolveAuditSeverity(action) === AUDIT_SEVERITIES.CRITICAL) {
    return "Las acciones críticas no pueden registrarse desde el cliente."
  }

  return "Acción de auditoría no permitida."
}
