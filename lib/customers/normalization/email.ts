import { trimString } from "@/lib/customers/normalization/text"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type NormalizedEmail = {
  raw: string
  normalized: string
  isValid: boolean
}

export function normalizeEmail(value: unknown): NormalizedEmail {
  const raw = trimString(value)
  if (!raw) {
    return { raw: "", normalized: "", isValid: true }
  }

  const normalized = raw.toLowerCase()
  return {
    raw,
    normalized,
    isValid: EMAIL_PATTERN.test(normalized),
  }
}

export function isValidEmail(value: string): boolean {
  const trimmed = trimString(value)
  if (!trimmed) return true
  return EMAIL_PATTERN.test(trimmed.toLowerCase())
}
