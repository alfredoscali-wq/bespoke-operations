/**
 * Normaliza un número de teléfono al formato internacional sin "+" (solo dígitos).
 * Acepta formatos locales argentinos y variantes con prefijo +54.
 */
export function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null

  if (digits.startsWith("54")) return digits

  if (digits.startsWith("0")) {
    const withoutLeadingZero = digits.replace(/^0+/, "")
    return withoutLeadingZero ? `54${withoutLeadingZero}` : null
  }

  if (digits.length >= 10 && digits.length <= 11) {
    return `54${digits}`
  }

  return digits.length >= 8 ? digits : null
}

export function buildWhatsAppUrl(phone: string): string | null {
  const normalized = normalizePhoneNumber(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}`
}

export function buildTelUrl(phone: string): string | null {
  const normalized = normalizePhoneNumber(phone)
  if (!normalized) return null
  return `tel:+${normalized}`
}
