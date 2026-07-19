/**
 * RC 3.2.3 — exclusive management helpers (one en_gestion per operator).
 */

import { formatConsultationExpedienteCode } from "@/lib/customer-atenciones/consultation-expediente"
import { formatConsultationRelativeAge } from "@/lib/customer-atenciones/consultation-expediente"
import type { CustomerAtencionInboxRow } from "@/lib/types/customer-atenciones"

export type OperatorActiveManagement = {
  atencionId: string
  expedienteCode: string
  customerName: string
  startedAt: string
  relativeAge: string
}

export function findOperatorActiveManagement(
  rows: readonly CustomerAtencionInboxRow[],
  employeeId: string,
  now: Date = new Date()
): OperatorActiveManagement | null {
  if (!employeeId) {
    return null
  }

  const active = rows.find(
    (row) =>
      row.status === "en_gestion" &&
      row.activeManagementEmployeeId === employeeId
  )

  if (!active) {
    return null
  }

  const startedAt = active.activeManagementStartedAt ?? active.updatedAt

  return {
    atencionId: active.id,
    expedienteCode: formatConsultationExpedienteCode(active.id),
    customerName: active.customerName,
    startedAt,
    relativeAge: formatConsultationRelativeAge(startedAt, now),
  }
}

export function parseBlockingAtencionIdFromManagementError(
  message: string
): string | null {
  const match = message.match(
    /blocking_atencion_id=([0-9a-f-]{36})/i
  )
  return match?.[1] ?? null
}

export function isOperatorAlreadyManagingError(code: string | undefined): boolean {
  return code === "CONSULTATION_OPERATOR_ALREADY_MANAGING"
}
