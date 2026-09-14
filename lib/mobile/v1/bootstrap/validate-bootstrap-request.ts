import { MobileApiError } from "@/lib/mobile/v1/errors"
import type { MobileBootstrapRequest } from "@/lib/mobile/v1/bootstrap/types"

export function normalizeMobileCompanyCode(value: string): string {
  return value.trim().toLowerCase()
}

export function validateMobileBootstrapRequest(
  body: unknown
): MobileBootstrapRequest {
  if (!body || typeof body !== "object") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  const record = body as Record<string, unknown>

  if (!Object.prototype.hasOwnProperty.call(record, "companyCode")) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "companyCode es obligatorio.",
      400
    )
  }

  if (typeof record.companyCode !== "string") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "companyCode es obligatorio.",
      400
    )
  }

  const companyCode = normalizeMobileCompanyCode(record.companyCode)

  if (!companyCode) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "companyCode es obligatorio.",
      400
    )
  }

  return { companyCode }
}
