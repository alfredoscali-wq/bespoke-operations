import "server-only"

import { randomUUID } from "node:crypto"

import { prepareWhatsappCommercialIntake } from "@/lib/subscriptions/whatsapp-commercial-intake"
import type { TvPlanKind, TvPlanServiceFact } from "@/lib/subscriptions/tv-plan-coordination"
import { loadTvPlanCommercialServices } from "@/lib/subscriptions/tv-plan-coordination-read"
import {
  normalizeWhatsappOriginPhone,
  resolveRepeatedWhatsappAcceptance,
  type WhatsappCommercialRequest,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import {
  classifyWhatsappCustomerMatches,
  type WhatsappIdentityContact,
} from "@/lib/subscriptions/whatsapp-customer-identity"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  findOpenWhatsappCommercialRequest,
  insertWhatsappCommercialRequest,
  listWhatsappIdentityContacts,
} from "@/lib/supabase/whatsapp-commercial-requests.queries"

export async function registerWhatsappCommercialRequest(input: {
  companyId: string
  originPhone: string
  offer: TvPlanKind
  externalMessageId: string
  now?: string
  accepted?: boolean
  contacts?: readonly WhatsappIdentityContact[]
}): Promise<
  | { ok: true; request: WhatsappCommercialRequest; duplicate: boolean }
  | { ok: false; message: string }
> {
  const companyId = input.companyId.trim()
  if (!companyId) return { ok: false, message: "Empresa no resuelta." }
  const originPhone = normalizeWhatsappOriginPhone(input.originPhone)
  if (!originPhone) return { ok: false, message: "Teléfono de origen inválido." }

  const admin = createAdminClient()
  const open = await findOpenWhatsappCommercialRequest(admin, companyId, originPhone, input.offer)
  if (open.error) return { ok: false, message: "No se pudo verificar solicitudes abiertas." }
  if (
    open.data &&
    resolveRepeatedWhatsappAcceptance({
      companyId,
      originPhone,
      offer: input.offer,
      existing: {
        companyId: open.data.companyId,
        originPhone: open.data.originPhone,
        offer: open.data.offer,
        status: open.data.status,
        customerId: open.data.customerId,
      },
    }) === "reuse"
  ) {
    return { ok: true, request: open.data, duplicate: true }
  }

  const contacts = input.contacts
    ? { data: input.contacts, error: null }
    : await listWhatsappIdentityContacts(admin, companyId, input.originPhone)
  if (contacts.error) return { ok: false, message: "No se pudo consultar Clientes 360." }

  const identity = classifyWhatsappCustomerMatches(input.originPhone, contacts.data)
  let services: TvPlanServiceFact[] | null = null
  if (identity.kind === "unique" && identity.customerId) {
    try {
      services = await loadTvPlanCommercialServices(admin, companyId, identity.customerId)
    } catch {
      services = null
    }
  }
  const prepared = prepareWhatsappCommercialIntake({
    id: randomUUID(),
    companyId,
    originPhone: input.originPhone,
    offer: input.offer,
    contacts: contacts.data,
    services,
    now: input.now ?? new Date().toISOString(),
    accepted: input.accepted === true,
  })
  if (!prepared.ok) return prepared

  const saved = await insertWhatsappCommercialRequest(
    admin,
    prepared.request,
    input.externalMessageId
  )
  if (saved.error) return { ok: false, message: "No se pudo registrar la solicitud." }
  return { ok: true, request: saved.data, duplicate: saved.duplicate === true }
}
