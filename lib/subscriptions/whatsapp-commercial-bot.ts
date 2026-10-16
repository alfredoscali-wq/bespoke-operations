import type { TvPlanKind } from "@/lib/subscriptions/tv-plan-coordination"
import type { WhatsappIdentityKind } from "@/lib/subscriptions/whatsapp-customer-identity"
import { formatTvMoney } from "@/lib/subscriptions/tv-plans"

export type WhatsappCatalogPrices = {
  packMonthlyPrice: number | null
  fullMonthlyPrice: number | null
}

export type WhatsappServiceState = "ready" | "missing" | "ambiguous" | "incompatible" | "unavailable"

export type WhatsappPersonalizedQuote = {
  offer: TvPlanKind
  monthlyFee: number
  currentLabel: string | null
  nextLabel: string | null
}

export type WhatsappInboundIntentMessage =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string }

export type WhatsappOutboundReply =
  | { type: "text"; body: string }
  | { type: "image"; link: string; caption: string }
  | { type: "buttons"; body: string; buttons: { id: string; title: string }[] }

export type WhatsappBotPlan = {
  replies: WhatsappOutboundReply[]
  acceptance: { offer: TvPlanKind } | null
  confirmation: string | null
}

const OFFER_LABEL: Record<TvPlanKind, string> = {
  basica: "TV Básica",
  pack: "Pack Fútbol",
  full: "TV Full",
}

export function planWhatsappCommercialTurn(input: {
  message: WhatsappInboundIntentMessage
  identity: WhatsappIdentityKind | "unavailable"
  service: WhatsappServiceState
  catalog: WhatsappCatalogPrices
  personalizedQuote: WhatsappPersonalizedQuote | null
  imageLink: string | null
  suppressOffers?: boolean
}): WhatsappBotPlan {
  const intent = interpretWhatsappIntent(input.message)
  if (input.suppressOffers || intent.type === "opt_out") {
    return {
      acceptance: null,
      confirmation: null,
      replies: [{ type: "text", body: optOutBody() }],
    }
  }
  const personal = canPersonalize(input) ? input.personalizedQuote : null
  const image = imageReply(input.imageLink, "Pack Fútbol y TV Full")

  if (intent.type === "greeting" || intent.type === "unknown") {
    return {
      acceptance: null,
      confirmation: null,
      replies: [
        ...(image ? [image] : []),
        {
          type: "buttons",
          body: greetingBody(),
          buttons: [
            { id: "offer:pack", title: "Pack Fútbol" },
            { id: "offer:full", title: "TV Full" },
            { id: "prices", title: "Ver precios" },
          ],
        },
      ],
    }
  }

  if (intent.type === "catalog") {
    return {
      acceptance: null,
      confirmation: null,
      replies: [{ type: "text", body: catalogBody(input.catalog) }],
    }
  }

  const offer = intent.offer
  const review = needsHumanReview(input, personal, offer)
  const detail = review
    ? reviewBody(input, input.catalog, offer)
    : personalBody(personal && personal.offer === offer ? personal : null, input.catalog, offer)

  if (intent.type === "offer") {
    return {
      acceptance: null,
      confirmation: null,
      replies: [
        ...(image ? [image] : []),
        { type: "text", body: detail },
        {
          type: "buttons",
          body: "Si querés avanzar, dejá el pedido para que un operador lo revise.",
          buttons: [{ id: `accept:${offer}`, title: acceptTitle(offer) }],
        },
      ],
    }
  }

  return {
    acceptance: { offer },
    confirmation: confirmationBody(offer, review),
    replies: [{ type: "text", body: detail }],
  }
}

export function whatsappAlreadyPendingBody(offer: TvPlanKind): string {
  return `Ya hay una solicitud pendiente de ${OFFER_LABEL[offer]}. No abrí otra. El plan no cambia desde este chat.`
}

export function interpretWhatsappIntent(
  message: WhatsappInboundIntentMessage
):
  | { type: "greeting" }
  | { type: "catalog" }
  | { type: "unknown" }
  | { type: "opt_out" }
  | { type: "offer"; offer: TvPlanKind }
  | { type: "accept"; offer: TvPlanKind } {
  if (message.kind === "button") {
    const id = message.id.trim().toLowerCase()
    if (id === "optout" || id === "stop" || id === "baja") return { type: "opt_out" }
    if (id === "menu" || id === "greeting") return { type: "greeting" }
    if (id === "prices" || id === "catalog") return { type: "catalog" }
    if (id === "offer:pack" || id === "pack") return { type: "offer", offer: "pack" }
    if (id === "offer:full" || id === "full") return { type: "offer", offer: "full" }
    if (id === "accept:pack") return { type: "accept", offer: "pack" }
    if (id === "accept:full") return { type: "accept", offer: "full" }
    return { type: "unknown" }
  }
  const text = message.text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text || /^(hola|buenas|buenos dias|buen dia|menu|inicio|start|hi|hello)$/.test(text)) {
    return { type: "greeting" }
  }
  if (isCommercialOptOut(text)) return { type: "opt_out" }
  const mentionsPack = /\b(pack|futbol)\b/.test(text)
  const mentionsFull = /\bfull\b/.test(text)
  const accepts = /\b(acepto|aceptar|confirmo)\b/.test(text)
  if (accepts && mentionsPack && !mentionsFull) return { type: "accept", offer: "pack" }
  if (accepts && mentionsFull && !mentionsPack) return { type: "accept", offer: "full" }
  if (mentionsPack && mentionsFull) return { type: "catalog" }
  if (/\b(precio|cuanto|sale|valor|abono|catalogo)\b/.test(text)) return { type: "catalog" }
  if (mentionsPack) return { type: "offer", offer: "pack" }
  if (mentionsFull) return { type: "offer", offer: "full" }
  return { type: "unknown" }
}

function isCommercialOptOut(text: string): boolean {
  if (/^(baja|stop|parar|detener|unsubscribe)$/.test(text)) return true
  return /\b(no quiero mensajes|no me contacten|no me escribas|dejar de recibir)\b/.test(text)
}

function optOutBody(): string {
  return "Listo. No te voy a enviar más mensajes comerciales por este chat. El plan de TV no cambia desde este mensaje."
}

function canPersonalize(input: {
  identity: WhatsappIdentityKind | "unavailable"
  service: WhatsappServiceState
  personalizedQuote: WhatsappPersonalizedQuote | null
}): boolean {
  return input.identity === "unique" && input.service === "ready" && input.personalizedQuote != null
}

function needsHumanReview(
  input: { identity: WhatsappIdentityKind | "unavailable"; service: WhatsappServiceState },
  personal: WhatsappPersonalizedQuote | null,
  offer: TvPlanKind
): boolean {
  if (input.identity !== "unique") return true
  if (input.service !== "ready") return true
  return personal == null || personal.offer !== offer
}

function greetingBody(): string {
  return "Hola, soy el asistente comercial de TV de ABNet. Puedo contarte Pack Fútbol y TV Full con los precios del catálogo. Un operador confirma cualquier cambio; desde este chat el plan queda igual."
}

function catalogBody(catalog: WhatsappCatalogPrices): string {
  return [
    "Precios vigentes del catálogo comercial:",
    priceLine("Pack Fútbol", catalog.packMonthlyPrice),
    priceLine("TV Full", catalog.fullMonthlyPrice),
    "Son precios de catálogo. El abono de un cliente se cotiza solo cuando el teléfono identifica una sola ficha y un solo servicio de TV.",
  ].join("\n")
}

function personalBody(
  quote: WhatsappPersonalizedQuote | null,
  catalog: WhatsappCatalogPrices,
  offer: TvPlanKind
): string {
  if (!quote) return reviewBody({ identity: "unique", service: "unavailable" }, catalog, offer)
  const current = quote.currentLabel ? ` Plan actual: ${quote.currentLabel}.` : ""
  const next = quote.nextLabel ? ` Destino cotizado: ${quote.nextLabel}.` : ""
  return `Para tu servicio, ${OFFER_LABEL[offer]} queda cotizado en ${formatTvMoney(quote.monthlyFee)} por mes.${current}${next} La cotización usa el catálogo y tu servicio vigente.`
}

function reviewBody(
  input: { identity: WhatsappIdentityKind | "unavailable"; service: WhatsappServiceState },
  catalog: WhatsappCatalogPrices,
  offer: TvPlanKind
): string {
  const price = offer === "full" ? catalog.fullMonthlyPrice : catalog.packMonthlyPrice
  const reason =
    input.identity !== "unique"
      ? "El teléfono está compartido, duplicado o no identifica una sola ficha."
      : "Hay más de un servicio de TV o no hay uno solo para cotizar."
  return [
    `${OFFER_LABEL[offer]}: ${priceLine("precio de catálogo", price)}`,
    `${reason} No armo una cotización personal automática. Un operador puede revisarlo.`,
  ].join("\n")
}

function confirmationBody(offer: TvPlanKind, review: boolean): string {
  const priceNote = review
    ? "Quedó sin precio personal, pendiente de revisión humana."
    : "La cotización quedó guardada en la solicitud."
  return `Dejé registrada una solicitud pendiente de ${OFFER_LABEL[offer]}. ${priceNote} El plan no cambia desde este chat.`
}

function priceLine(label: string, amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) {
    return `${label}: el catálogo no tiene ese precio cargado.`
  }
  return `${label}: ${formatTvMoney(amount)} por mes.`
}

function acceptTitle(offer: TvPlanKind): string {
  return offer === "full" ? "Acepto TV Full" : "Acepto Pack"
}

function imageReply(link: string | null, caption: string): WhatsappOutboundReply | null {
  if (!link) return null
  try {
    const url = new URL(link)
    if (url.protocol !== "https:") return null
    return { type: "image", link: url.toString(), caption }
  } catch {
    return null
  }
}
