/**
 * RC 3.2.5 — exclusive consultation lock helpers (presentation + config).
 */

import { formatConsultationRelativeAge } from "@/lib/customer-atenciones/consultation-expediente"
import type {
  CustomerAtencionInboxRow,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

/** Default inactivity timeout (minutes). Keep in sync with DB function. */
export const CONSULTATION_MANAGEMENT_LOCK_TIMEOUT_MINUTES = 15

export type LockedConsultationInfo = {
  managerEmployeeId: string | null
  managerName: string
  startedAt: string | null
  startedAtLabel: string
  relativeAge: string
}

export function formatInboxManagingCell(input: {
  status: CustomerAtencionStatus
  activeManagementEmployeeId?: string | null
  activeManagementEmployeeName?: string | null
  currentEmployeeId?: string | null
}): string {
  if (
    input.status !== "en_gestion" ||
    !input.activeManagementEmployeeId
  ) {
    return ""
  }

  if (
    input.currentEmployeeId &&
    input.activeManagementEmployeeId === input.currentEmployeeId
  ) {
    return "🟢 Vos"
  }

  return input.activeManagementEmployeeName?.trim() || ""
}

export function buildLockedConsultationInfo(input: {
  managerEmployeeId?: string | null
  managerName?: string | null
  startedAt?: string | null
  now?: Date
}): LockedConsultationInfo {
  const startedAt = input.startedAt?.trim() || null
  const now = input.now ?? new Date()

  return {
    managerEmployeeId: input.managerEmployeeId?.trim() || null,
    managerName:
      input.managerName?.trim() && input.managerName.trim() !== "—"
        ? input.managerName.trim()
        : "Otro operador",
    startedAt,
    startedAtLabel: startedAt
      ? new Date(startedAt).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    relativeAge: startedAt
      ? formatConsultationRelativeAge(startedAt, now)
      : "—",
  }
}

export function parseLockedManagementFromError(
  message: string
): { managerEmployeeId: string | null; startedAt: string | null } {
  const managerMatch = message.match(
    /manager_employee_id=([0-9a-f-]{36})/i
  )
  const startedMatch = message.match(
    /started_at=([0-9T:\-Z.]+)/i
  )

  return {
    managerEmployeeId: managerMatch?.[1] ?? null,
    startedAt: startedMatch?.[1] && startedMatch[1].length > 0
      ? startedMatch[1]
      : null,
  }
}

export function isManagementLockExpired(
  row: {
    activeManagementLastActivityAt?: string | null
    activeManagementStartedAt?: string | null
  },
  now: Date = new Date(),
  timeoutMinutes: number = CONSULTATION_MANAGEMENT_LOCK_TIMEOUT_MINUTES
): boolean {
  const last =
    row.activeManagementLastActivityAt?.trim() ||
    row.activeManagementStartedAt?.trim() ||
    null

  if (!last) {
    return false
  }

  const lastMs = new Date(last).getTime()
  if (Number.isNaN(lastMs)) {
    return false
  }

  return now.getTime() - lastMs >= timeoutMinutes * 60_000
}

export function inboxRowHasActiveManager(
  row: Pick<
    CustomerAtencionInboxRow,
    "status" | "activeManagementEmployeeId"
  >
): boolean {
  return (
    row.status === "en_gestion" && Boolean(row.activeManagementEmployeeId)
  )
}
