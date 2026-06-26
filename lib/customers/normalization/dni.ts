import { trimString } from "@/lib/customers/normalization/text"

export type NormalizedDni = {
  raw: string
  digits: string
  isValid: boolean
}

/** Conserva solo dígitos del documento del abonado. */
export function normalizeDni(value: unknown): NormalizedDni {
  const raw = trimString(value)
  const digits = raw.replace(/\D/g, "")

  return {
    raw,
    digits,
    isValid: digits.length >= 7 && digits.length <= 11,
  }
}
