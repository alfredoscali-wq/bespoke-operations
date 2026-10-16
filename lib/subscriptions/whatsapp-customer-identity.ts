import { normalizeWhatsappOriginPhone } from "@/lib/subscriptions/whatsapp-commercial-requests"

export type WhatsappIdentityContact = {
  customerId: string
  phone: string | null
  whatsapp: string | null
}

export type WhatsappIdentityKind = "invalid" | "none" | "unique" | "ambiguous"

export type WhatsappIdentityClassification = {
  kind: WhatsappIdentityKind
  customerId: string | null
}

/**
 * Clientes 360 phones are the identity source. A request is linked only when
 * one customer owns the normalized number. Shared, duplicated, incomplete, or
 * conflicting phones stay unresolved for a person to review.
 */
export function classifyWhatsappCustomerMatches(
  originPhone: string,
  contacts: readonly WhatsappIdentityContact[]
): WhatsappIdentityClassification {
  const origin = normalizeWhatsappOriginPhone(originPhone)
  if (!origin) return { kind: "invalid", customerId: null }

  const ids = new Set<string>()
  for (const contact of contacts) {
    const customerId = contact.customerId.trim()
    if (!customerId) continue
    if (sameWhatsappPhone(contact.phone, origin) || sameWhatsappPhone(contact.whatsapp, origin)) {
      ids.add(customerId)
    }
  }

  if (ids.size === 0) return { kind: "none", customerId: null }
  if (ids.size === 1) return { kind: "unique", customerId: [...ids][0] }
  return { kind: "ambiguous", customerId: null }
}

function sameWhatsappPhone(value: string | null | undefined, origin: string): boolean {
  if (!value?.trim()) return false
  return normalizeWhatsappOriginPhone(value) === origin
}
