import type { AppUserRole } from "@/lib/auth/current-user"
import type { EvidenceRecord } from "@/lib/types/evidence"

export const EVIDENCE_VOID_HISTORY_ACTION = "Evidencia anulada"

export function isActiveEvidence(
  record: Pick<EvidenceRecord, "deletedAt">
): boolean {
  return !record.deletedAt
}

export function getActiveEvidence(evidence: EvidenceRecord[]): EvidenceRecord[] {
  return evidence.filter(isActiveEvidence)
}

export function canVoidEvidence(role: AppUserRole): boolean {
  return (
    role === "administrador" ||
    role === "coordinador" ||
    role === "supervisor"
  )
}

export function resolveEvidenceVoidDetails(record: EvidenceRecord): {
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
} {
  if (!record.deletedAt) {
    return {}
  }

  const voidEvent = record.uploadHistory.find(
    (event) => event.action === EVIDENCE_VOID_HISTORY_ACTION
  )

  return {
    voidedAt: record.deletedAt,
    voidedBy: voidEvent?.user,
    voidReason: voidEvent?.note,
  }
}
