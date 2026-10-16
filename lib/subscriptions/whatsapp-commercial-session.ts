import "server-only"

import { readWhatsappCommercialImageLink } from "@/lib/integrations/whatsapp/commercial-image"
import {
  readWhatsappSendConfig,
  sendWhatsappImage,
  sendWhatsappReplyButtons,
  sendWhatsappText,
  type WhatsappSendResult,
} from "@/lib/integrations/whatsapp/graph-client"
import {
  webhookRetryForReceipt,
  whatsappDoneKey,
  whatsappOptOutKey,
} from "@/lib/integrations/whatsapp/message-ledger"
import type { WhatsappInboundMessage } from "@/lib/integrations/whatsapp/webhook-guard"
import { loadWhatsappCatalogPrices } from "@/lib/subscriptions/whatsapp-commercial-catalog"
import {
  interpretWhatsappIntent,
  planWhatsappCommercialTurn,
  whatsappAlreadyPendingBody,
  type WhatsappOutboundReply,
} from "@/lib/subscriptions/whatsapp-commercial-bot"
import { registerWhatsappCommercialRequest } from "@/lib/subscriptions/whatsapp-commercial-register"
import { normalizeWhatsappOriginPhone } from "@/lib/subscriptions/whatsapp-commercial-requests"
import {
  whatsappPersonalizedQuote,
  whatsappServiceState,
} from "@/lib/subscriptions/whatsapp-commercial-turn"
import {
  deliverWhatsappReplies,
  whatsappTurnFullyConfirmed,
  type WhatsappDeliveryLedger,
} from "@/lib/subscriptions/whatsapp-outbound-delivery"
import type { TvPlanKind, TvPlanServiceFact } from "@/lib/subscriptions/tv-plan-coordination"
import { loadTvPlanCommercialServices } from "@/lib/subscriptions/tv-plan-coordination-read"
import {
  classifyWhatsappCustomerMatches,
  type WhatsappIdentityContact,
  type WhatsappIdentityKind,
} from "@/lib/subscriptions/whatsapp-customer-identity"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  claimWhatsappInboundMessage,
  deleteWhatsappLedgerKey,
  hasWhatsappInboundMessage,
  listWhatsappIdentityContacts,
  listWhatsappLedgerKeys,
} from "@/lib/supabase/whatsapp-commercial-requests.queries"

export async function handleWhatsappInboundMessage(input: {
  companyId: string
  message: WhatsappInboundMessage
}): Promise<{
  duplicate: boolean
  registered: boolean
  outboundConfirmed: boolean
  retry: boolean
}> {
  const admin = createAdminClient()
  const companyId = input.companyId.trim()
  const inboundId = input.message.externalMessageId.trim()
  if (!companyId || !inboundId || !readWhatsappSendConfig(process.env)) {
    return { duplicate: false, registered: false, outboundConfirmed: false, retry: true }
  }

  const seen = await hasWhatsappInboundMessage(admin, companyId, whatsappDoneKey(inboundId))
  const gate = webhookRetryForReceipt(seen)
  if (gate === "retry") {
    return { duplicate: false, registered: false, outboundConfirmed: false, retry: true }
  }
  if (gate === "stop") {
    return { duplicate: true, registered: false, outboundConfirmed: true, retry: false }
  }

  const phone = normalizeWhatsappOriginPhone(input.message.from)
  const opted = phone
    ? await hasWhatsappInboundMessage(admin, companyId, whatsappOptOutKey(phone))
    : "missing"
  if (opted === "unavailable") {
    return { duplicate: false, registered: false, outboundConfirmed: false, retry: true }
  }

  const inbound = input.message.buttonId
    ? { kind: "button" as const, id: input.message.buttonId }
    : { kind: "text" as const, text: input.message.text ?? "" }
  const intent = interpretWhatsappIntent(inbound)
  const suppressOffers = opted === "seen" || intent.type === "opt_out"
  if (intent.type === "opt_out" && phone) {
    const recorded = await claimWhatsappInboundMessage(admin, companyId, whatsappOptOutKey(phone))
    if (recorded === "unavailable") {
      return { duplicate: false, registered: false, outboundConfirmed: false, retry: true }
    }
  }

  let identity: WhatsappIdentityKind | "unavailable" = "unavailable"
  let services: TvPlanServiceFact[] | null = null
  let contacts: WhatsappIdentityContact[] = []
  if (!suppressOffers) {
    const loaded = await listWhatsappIdentityContacts(admin, companyId, input.message.from)
    if (loaded.error) {
      return { duplicate: false, registered: false, outboundConfirmed: false, retry: true }
    }
    contacts = loaded.data
    const classified = classifyWhatsappCustomerMatches(input.message.from, contacts)
    identity = classified.kind
    if (identity === "unique" && classified.customerId) {
      try {
        services = await loadTvPlanCommercialServices(admin, companyId, classified.customerId)
      } catch {
        services = null
      }
    }
  }

  const offer = intent.type === "offer" || intent.type === "accept" ? intent.offer : null
  const catalog = suppressOffers
    ? { packMonthlyPrice: null, fullMonthlyPrice: null }
    : await loadWhatsappCatalogPrices(admin, companyId)
  const plan = planWhatsappCommercialTurn({
    message: inbound,
    identity,
    service: whatsappServiceState(identity === "unique" ? services : null),
    catalog,
    personalizedQuote:
      !suppressOffers && identity === "unique" && offer
        ? whatsappPersonalizedQuote(offer, services)
        : null,
    imageLink: suppressOffers
      ? null
      : readWhatsappCommercialImageLink(process.env.WHATSAPP_COMMERCIAL_IMAGE_LINK),
    suppressOffers,
  })

  let replies = plan.replies
  let registered = false
  let duplicate = false
  if (plan.acceptance && !suppressOffers) {
    const saved = await registerAcceptance(companyId, input.message, plan.acceptance.offer, contacts)
    if (!saved.ok) {
      return { duplicate: false, registered: false, outboundConfirmed: false, retry: true }
    }
    duplicate = saved.duplicate
    registered = !saved.duplicate
    const confirmation = saved.duplicate
      ? whatsappAlreadyPendingBody(plan.acceptance.offer)
      : plan.confirmation
    if (confirmation) replies = [...plan.replies, { type: "text", body: confirmation }]
  }

  const config = readWhatsappSendConfig(process.env)
  const delivered = await deliverWhatsappReplies({
    companyId,
    inboundId,
    replies,
    ledger: ledgerFor(admin),
    send: (reply) => sendReply(config, input.message.from, reply),
  })
  const outboundConfirmed = whatsappTurnFullyConfirmed(replies.length, delivered.slots)
  if (outboundConfirmed) {
    await claimWhatsappInboundMessage(admin, companyId, whatsappDoneKey(inboundId))
  }
  return {
    duplicate: duplicate || delivered.slots.some((slot) => slot.state === "already_confirmed"),
    registered,
    outboundConfirmed,
    retry: delivered.retry,
  }
}

function ledgerFor(
  admin: ReturnType<typeof createAdminClient>
): WhatsappDeliveryLedger {
  return {
    has: (companyId, key) => hasWhatsappInboundMessage(admin, companyId, key),
    claim: (companyId, key) => claimWhatsappInboundMessage(admin, companyId, key),
    release: (companyId, key) => deleteWhatsappLedgerKey(admin, companyId, key),
    list: (companyId, prefix) => listWhatsappLedgerKeys(admin, companyId, prefix),
  }
}

async function registerAcceptance(
  companyId: string,
  message: WhatsappInboundMessage,
  offer: TvPlanKind,
  contacts: readonly WhatsappIdentityContact[]
) {
  return registerWhatsappCommercialRequest({
    companyId,
    originPhone: message.from,
    offer,
    externalMessageId: message.externalMessageId,
    accepted: true,
    contacts,
  })
}

async function sendReply(
  config: ReturnType<typeof readWhatsappSendConfig>,
  to: string,
  reply: WhatsappOutboundReply
): Promise<WhatsappSendResult> {
  if (reply.type === "text") {
    return sendWhatsappText({ config, to, body: reply.body })
  }
  if (reply.type === "image") {
    return sendWhatsappImage({ config, to, link: reply.link, caption: reply.caption })
  }
  return sendWhatsappReplyButtons({
    config,
    to,
    body: reply.body,
    buttons: reply.buttons,
  })
}
