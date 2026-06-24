import { resolveEvidenceActor } from "@/lib/auth/auth-display"
import type { AppUserRole } from "@/lib/auth/current-user"
import type { SessionUser } from "@/lib/auth/types"
import { FIELD_WORKER } from "@/lib/data/operario"
import type { EvidenceUploadOrigin } from "@/lib/evidence/upload-origin"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type { UploadEvidenceInput } from "@/lib/types/supabase/evidences"

export type EvidenceUploader = {
  uploadedBy: string
  uploadedByRole: AppUserRole
}

export function resolveEvidenceUploader(
  origin: EvidenceUploadOrigin = "dashboard",
  options?: {
    operarioName?: string
    sessionUser?: SessionUser | null
  }
): EvidenceUploader {
  if (origin === "operario") {
    return {
      uploadedBy: options?.operarioName ?? FIELD_WORKER.name,
      uploadedByRole: "operario",
    }
  }

  const actor = resolveEvidenceActor(options?.sessionUser ?? null)

  return {
    uploadedBy: actor.name,
    uploadedByRole: actor.role,
  }
}

export function normalizeUploadEvidenceInput(
  input: UploadEvidenceInput,
  sessionUser?: SessionUser | null
): UploadEvidenceInput & { worker: string; uploadedByRole: AppUserRole } {
  const uploader = resolveEvidenceUploader(input.origin ?? "dashboard", {
    operarioName: input.worker,
    sessionUser,
  })

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
