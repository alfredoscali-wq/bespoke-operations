import { FIELD_WORKER } from "@/lib/data/operario"
import type { EvidenceUploadOrigin } from "@/lib/evidence/upload-origin"
import type { EvidenceRecord } from "@/lib/types/evidence"
import {
  DASHBOARD_USER,
  type AppUserRole,
} from "@/lib/auth/current-user"
import type { UploadEvidenceInput } from "@/lib/types/supabase/evidences"

export type EvidenceUploader = {
  uploadedBy: string
  uploadedByRole: AppUserRole
}

/**
 * Resolves the uploader for a new evidence record.
 * TODO(auth): replace simulation with supabase.auth.getUser() + profile lookup.
 */
export function resolveEvidenceUploader(
  origin: EvidenceUploadOrigin = "dashboard",
  operarioName?: string
): EvidenceUploader {
  if (origin === "operario") {
    return {
      uploadedBy: operarioName ?? FIELD_WORKER.name,
      uploadedByRole: "operario",
    }
  }

  return {
    uploadedBy: DASHBOARD_USER.name,
    uploadedByRole: DASHBOARD_USER.role,
  }
}

export function normalizeUploadEvidenceInput(
  input: UploadEvidenceInput
): UploadEvidenceInput & { worker: string; uploadedByRole: AppUserRole } {
  const uploader = resolveEvidenceUploader(
    input.origin ?? "dashboard",
    input.worker
  )

  return {
    ...input,
    worker: input.worker?.trim() || uploader.uploadedBy,
    uploadedByRole: input.uploadedByRole ?? uploader.uploadedByRole,
  }
}

export function resolveEvidenceUploadedByRole(
  record: Pick<EvidenceRecord, "uploadedByRole" | "uploadHistory">
): AppUserRole | undefined {
  if (record.uploadedByRole) {
    return record.uploadedByRole
  }

  return record.uploadHistory.find(
    (event) => event.action === "Archivo cargado"
  )?.role
}
