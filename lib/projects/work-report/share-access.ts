export type ProjectWorkReportShareAccessReason =
  | "not_found"
  | "revoked"
  | "expired"

export type ProjectWorkReportShareAccess =
  | { ok: true }
  | { ok: false; reason: ProjectWorkReportShareAccessReason }

export type ProjectWorkReportShareAccessInput = {
  revokedAt?: string | null
  expiresAt?: string | null
  companyId: string
  projectId: string
}

export function evaluateProjectWorkReportShareAccess(
  share: ProjectWorkReportShareAccessInput | null | undefined,
  now: Date = new Date()
): ProjectWorkReportShareAccess {
  if (!share) {
    return { ok: false, reason: "not_found" }
  }

  if (share.revokedAt) {
    return { ok: false, reason: "revoked" }
  }

  if (share.expiresAt) {
    const expiresAt = Date.parse(share.expiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return { ok: false, reason: "expired" }
    }
  }

  return { ok: true }
}

export function shareBelongsToCompanyProject(
  share: Pick<ProjectWorkReportShareAccessInput, "companyId" | "projectId">,
  companyId: string,
  projectId: string
): boolean {
  return share.companyId === companyId && share.projectId === projectId
}

export function publicShareDenialMessage(): string {
  return "Este informe no está disponible."
}
