import type { TvPlanKind, TvPlanServiceFact } from "@/lib/subscriptions/tv-plan-coordination"
import {
  quoteTvPlanDestination,
  resolveTvPlanService,
} from "@/lib/subscriptions/tv-plan-coordination"
import {
  buildWhatsappCommercialRequest,
  type WhatsappCommercialRequest,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import {
  classifyWhatsappCustomerMatches,
  type WhatsappIdentityContact,
} from "@/lib/subscriptions/whatsapp-customer-identity"

export function prepareWhatsappCommercialIntake(input: {
  id: string
  companyId: string
  originPhone: string
  offer: TvPlanKind
  contacts: readonly WhatsappIdentityContact[]
  services: readonly TvPlanServiceFact[] | null
  now: string
  accepted?: boolean
}): { ok: true; request: WhatsappCommercialRequest } | { ok: false; message: string } {
  const identity = classifyWhatsappCustomerMatches(input.originPhone, input.contacts)
  const linked = identity.kind === "unique" && identity.customerId ? identity.customerId : null
  const resolved = linked && input.services ? resolveTvPlanService(input.services) : null
  const service = resolved?.ok ? resolved.service : null
  const quote = service
    ? quoteTvPlanDestination({
        service,
        kind: input.offer,
        latamAvailable: true,
      })
    : null

  return buildWhatsappCommercialRequest({
    id: input.id,
    companyId: input.companyId,
    originPhone: input.originPhone,
    offer: input.offer,
    matches: linked ? [{ customerId: linked }] : [],
    phoneVerified: Boolean(linked),
    quote,
    service,
    customerAccepted: input.accepted === true ? true : null,
    customerAcceptedAt: input.accepted === true ? input.now : null,
    now: input.now,
  })
}
