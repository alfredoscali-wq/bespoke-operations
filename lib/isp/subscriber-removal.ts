export const ISP_SUBSCRIBER_REMOVAL_CONFIRMATION = "ELIMINAR"

export const ISP_SUBSCRIBER_REMOVED_MESSAGE = "Abonado eliminado"

export const ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE =
  "No se pudo eliminar el abonado. Intentá nuevamente."

export const ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE =
  "Solo un administrador puede eliminar un abonado ISP."

export const ISP_SUBSCRIBER_REMOVAL_HISTORY_NOTE =
  "Sus datos históricos no serán eliminados."

export function ispSubscriberRemovalLead(name: string): string {
  const trimmed = name.trim() || "este abonado"
  return `Vas a quitar a ${trimmed} del directorio de abonados ISP.`
}

export function isIspSubscriberRemovalConfirmation(value: string): boolean {
  return value === ISP_SUBSCRIBER_REMOVAL_CONFIRMATION
}

export function hasActiveIspSubscriberMembership(
  deletedAt: string | null | undefined
): boolean {
  return deletedAt == null || deletedAt === ""
}

export type IspSubscriberRemovalResult =
  | { ok: true; alreadyRemoved: boolean }
  | {
      ok: false
      code: "forbidden" | "not_found" | "invalid_confirmation" | "failed"
    }

export function resolveIspSubscriberRemovalResult(input: {
  isAdmin: boolean
  confirmation: string
  sessionCompanyId: string
  membership: {
    companyId: string
    deletedAt: string | null
  } | null
}): IspSubscriberRemovalResult {
  if (!input.isAdmin) {
    return { ok: false, code: "forbidden" }
  }

  if (!isIspSubscriberRemovalConfirmation(input.confirmation)) {
    return { ok: false, code: "invalid_confirmation" }
  }

  if (
    !input.membership ||
    input.membership.companyId !== input.sessionCompanyId
  ) {
    return { ok: false, code: "not_found" }
  }

  if (!hasActiveIspSubscriberMembership(input.membership.deletedAt)) {
    return { ok: true, alreadyRemoved: true }
  }

  return { ok: true, alreadyRemoved: false }
}

export function isIspSubscriberRemovalResolved(
  status: number,
  body: { success?: boolean; alreadyRemoved?: boolean } | null
): boolean {
  if (status === 404) return true
  if (body?.success === true) return true
  if (body?.alreadyRemoved === true) return true
  return false
}

export function ispSubscriberRemovalUserMessage(error: unknown): {
  status: number
  message: string
  alreadyRemoved?: boolean
} {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""

  if (/administrador/i.test(raw) || /autoriz/i.test(raw)) {
    return { status: 403, message: ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE }
  }

  if (/no encontrado/i.test(raw)) {
    return {
      status: 404,
      message: ISP_SUBSCRIBER_REMOVED_MESSAGE,
      alreadyRemoved: true,
    }
  }

  return { status: 400, message: ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE }
}
