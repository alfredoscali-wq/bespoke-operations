import { trimString } from "@/lib/customers/normalization/text"

export type NormalizedPhone = {
  raw: string
  /** Solo dígitos (sin +). Ej: 3516123456 o 5493516123456 */
  digits: string
  /** Formato nacional operativo (10 dígitos cuando aplica). */
  national: string
  /** E.164 para WhatsApp cuando es posible derivarlo. Ej: +5493516123456 */
  whatsapp: string
  isValid: boolean
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Normaliza teléfonos argentinos para operaciones y WhatsApp.
 * Acepta: 3516123456, +54 9 351 612-3456, +543516123456, etc.
 */
export function normalizePhone(value: unknown): NormalizedPhone {
  const raw = trimString(value)
  if (!raw) {
    return { raw: "", digits: "", national: "", whatsapp: "", isValid: false }
  }

  let digits = digitsOnly(raw)
  if (!digits) {
    return { raw, digits: "", national: "", whatsapp: "", isValid: false }
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2)
  }

  if (digits.startsWith("54")) {
    const whatsapp = `+${digits}`
    const national =
      digits.length === 12 && !digits.startsWith("549")
        ? digits.slice(2)
        : digits.startsWith("549")
          ? digits.slice(3)
          : digits.slice(2)

    return {
      raw,
      digits,
      national,
      whatsapp,
      isValid: digits.length >= 10,
    }
  }

  if (digits.length === 10) {
    const whatsapp = `+549${digits}`
    return {
      raw,
      digits,
      national: digits,
      whatsapp,
      isValid: true,
    }
  }

  if (digits.length === 11 && digits.startsWith("9")) {
    const national = digits.slice(1)
    return {
      raw,
      digits,
      national,
      whatsapp: `+54${digits}`,
      isValid: true,
    }
  }

  return {
    raw,
    digits,
    national: digits,
    whatsapp: digits.length >= 10 ? `+${digits}` : "",
    isValid: digits.length >= 8,
  }
}

/** Alias explícito para integraciones WhatsApp. */
export function normalizePhoneForWhatsApp(value: unknown): string {
  return normalizePhone(value).whatsapp
}
