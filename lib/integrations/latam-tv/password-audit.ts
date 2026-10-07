import "server-only"

import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  AUDIT_SEVERITIES,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"

export type LatamPasswordAuditResult = "changed" | "not_found" | "rejected" | "unavailable"

/**
 * Reutiliza el historial de clientes. La operación queda en metadata.
 * No recibe ni guarda la contraseña.
 */
export async function recordLatamPasswordChangeAudit(input: {
  sessionUser: SessionUser
  companyId: string
  customerId: string
  identifier: string
  result: LatamPasswordAuditResult
}): Promise<void> {
  await recordAuditEventServer({
    module: AUDIT_MODULES.CLIENTES,
    action: AUDIT_ACTIONS.CUSTOMER_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: input.customerId,
    entityLabel: input.identifier,
    description:
      input.result === "changed"
        ? "Se cambió la contraseña de LATAM TV."
        : input.result === "not_found"
          ? "No se cambió la contraseña: el cliente no existe en LATAM TV."
          : input.result === "rejected"
            ? "LATAM TV no pudo modificar la contraseña."
            : "No se pudo comunicar con LATAM TV para cambiar la contraseña.",
    severity: AUDIT_SEVERITIES.WARNING,
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    companyId: input.companyId,
    metadata: {
      operation: "change_password",
      customerId: input.customerId,
      identifier: input.identifier,
      result: input.result,
    },
  })
}

export type LatamStatusAuditOperation = "disable_client" | "enable_client"

export type LatamStatusAuditResult =
  | "updated"
  | "not_found"
  | "rejected"
  | "unavailable"
  | "mismatch"

export async function recordLatamClientStatusAudit(input: {
  sessionUser: SessionUser
  companyId: string
  customerId: string
  identifier: string
  operation: LatamStatusAuditOperation
  result: LatamStatusAuditResult
}): Promise<void> {
  await recordAuditEventServer({
    module: AUDIT_MODULES.CLIENTES,
    action: AUDIT_ACTIONS.CUSTOMER_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: input.customerId,
    entityLabel: input.identifier,
    description:
      input.result === "updated"
        ? input.operation === "disable_client"
          ? "Se suspendió el cliente en LATAM TV."
          : "Se activó el cliente en LATAM TV."
        : input.result === "not_found"
          ? "No se cambió el estado: el cliente no existe en LATAM TV."
          : input.result === "rejected"
            ? "LATAM TV no pudo cambiar el estado del cliente."
            : input.result === "mismatch"
              ? "No se cambió el estado: la acción no corresponde al estado actual."
              : "No se pudo comunicar con LATAM TV para cambiar el estado.",
    severity: AUDIT_SEVERITIES.WARNING,
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    companyId: input.companyId,
    metadata: {
      operation: input.operation,
      customerId: input.customerId,
      identifier: input.identifier,
      result: input.result,
    },
  })
}
