import type { EvidenceStatus } from "@/lib/types/evidence"

export type EvidenceUploadOrigin = "dashboard" | "operario"

export function resolveEvidenceStatusForOrigin(
  origin: EvidenceUploadOrigin = "dashboard"
): EvidenceStatus {
  return origin === "operario" ? "pending-review" : "approved"
}
