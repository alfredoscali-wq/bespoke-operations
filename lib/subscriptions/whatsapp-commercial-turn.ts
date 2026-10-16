import type { WhatsappSendResult } from "@/lib/integrations/whatsapp/graph-client"
import {
  quoteTvPlanDestination,
  resolveTvPlanService,
  type TvPlanKind,
  type TvPlanServiceFact,
} from "@/lib/subscriptions/tv-plan-coordination"
import {
  snapshotWhatsappCommercialQuote,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import type {
  WhatsappBotPlan,
  WhatsappOutboundReply,
  WhatsappPersonalizedQuote,
  WhatsappServiceState,
} from "@/lib/subscriptions/whatsapp-commercial-bot"

export function whatsappServiceState(
  services: readonly TvPlanServiceFact[] | null
): WhatsappServiceState {
  if (!services) return "unavailable"
  const resolved = resolveTvPlanService(services)
  if (resolved.ok) return "ready"
  if (resolved.code === "ambiguous_service") return "ambiguous"
  if (resolved.code === "missing_service") return "missing"
  if (resolved.code === "incompatible_service") return "incompatible"
  return "unavailable"
}

export function whatsappPersonalizedQuote(
  offer: TvPlanKind,
  services: readonly TvPlanServiceFact[] | null
): WhatsappPersonalizedQuote | null {
  if (!services) return null
  const resolved = resolveTvPlanService(services)
  if (!resolved.ok) return null
  const quote = quoteTvPlanDestination({
    service: resolved.service,
    kind: offer,
    latamAvailable: true,
  })
  const snapshot = snapshotWhatsappCommercialQuote({ quote, service: resolved.service })
  if (!snapshot) return null
  return {
    offer,
    monthlyFee: snapshot.quotedMonthlyFee,
    currentLabel: snapshot.currentPlanLabel,
    nextLabel: snapshot.destinationPlanLabel,
  }
}

export async function deliverWhatsappCommercialTurn(input: {
  alreadyProcessed: boolean
  plan: WhatsappBotPlan
  registerAcceptance: () => Promise<
    { ok: true; duplicate: boolean } | { ok: false; message: string }
  >
  send: (reply: WhatsappOutboundReply) => Promise<WhatsappSendResult>
}): Promise<{
  duplicate: boolean
  registered: boolean
  failed: boolean
  sends: WhatsappSendResult[]
  outboundConfirmed: boolean
}> {
  if (input.alreadyProcessed) {
    return { duplicate: true, registered: false, failed: false, sends: [], outboundConfirmed: false }
  }

  let registered = false
  let duplicate = false
  if (input.plan.acceptance) {
    const saved = await input.registerAcceptance()
    if (!saved.ok) {
      return { duplicate: false, registered: false, failed: true, sends: [], outboundConfirmed: false }
    }
    registered = true
    duplicate = saved.duplicate
  }

  const replies: WhatsappOutboundReply[] = [
    ...input.plan.replies,
    ...(registered && input.plan.confirmation
      ? [{ type: "text" as const, body: input.plan.confirmation }]
      : []),
  ]
  const sends: WhatsappSendResult[] = []
  for (const reply of replies) {
    const result = await input.send(reply)
    sends.push(result)
    if (!result.sent) break
  }
  return {
    duplicate,
    registered,
    failed: false,
    sends,
    outboundConfirmed: sends.length > 0 && sends.every((item) => item.sent),
  }
}
