import { createHmac, timingSafeEqual } from "node:crypto"

import type { TvPlanKind } from "@/lib/subscriptions/tv-plan-coordination"

const OFFERS = new Set<TvPlanKind>(["basica", "pack", "full"])

export type WhatsappCommercialEvent = {
  externalMessageId: string
  from: string
  offer: TvPlanKind
}

export type WhatsappInboundMessage = {
  externalMessageId: string
  from: string
  text: string | null
  buttonId: string | null
}

export function verifyMetaWebhookSignature(input: {
  rawBody: string
  signatureHeader: string | null
  appSecret: string
}): boolean {
  const secret = input.appSecret.trim()
  const header = input.signatureHeader?.trim() ?? ""
  if (!secret || !header.startsWith("sha256=")) return false
  const received = header.slice("sha256=".length).trim().toLowerCase()
  const expected = createHmac("sha256", secret).update(input.rawBody).digest("hex")
  return safeEqual(expected, received)
}

export function verifyWhatsappWebhookToken(input: {
  providedToken: string | null
  configuredToken: string
}): boolean {
  const configured = input.configuredToken.trim()
  const provided = input.providedToken?.trim() ?? ""
  if (!configured || !provided) return false
  return safeEqual(configured, provided)
}

/**
 * The company comes from the configured commercial number. A company id inside
 * the message payload is ignored by not reading it here.
 */
export function resolveWhatsappBusinessCompany(input: {
  configuredPhoneNumberId: string
  configuredCompanyId: string
  payloadPhoneNumberId: string
}): { ok: true; companyId: string } | { ok: false } {
  const configuredPhone = input.configuredPhoneNumberId.trim()
  const payloadPhone = input.payloadPhoneNumberId.trim()
  const companyId = input.configuredCompanyId.trim()
  if (!configuredPhone || !payloadPhone || !isUuid(companyId)) return { ok: false }
  if (!safeEqual(configuredPhone, payloadPhone)) return { ok: false }
  return { ok: true, companyId }
}

export function readWhatsappCommercialEvents(body: unknown):
  | { ok: true; phoneNumberId: string; events: WhatsappCommercialEvent[] }
  | { ok: false; reason: "ignored" | "mixed_number" } {
  const root = asRecord(body)
  if (!root || root.object !== "whatsapp_business_account") {
    return { ok: false, reason: "ignored" }
  }
  const entries = Array.isArray(root.entry) ? root.entry : []
  let phoneNumberId = ""
  const events: WhatsappCommercialEvent[] = []

  for (const entry of entries) {
    const changes = asRecord(entry)?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value)
      const metadata = asRecord(value?.metadata)
      const currentPhone =
        typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id.trim() : ""
      if (!currentPhone) continue
      if (!phoneNumberId) phoneNumberId = currentPhone
      if (currentPhone !== phoneNumberId) return { ok: false, reason: "mixed_number" }
      const messages = Array.isArray(value?.messages) ? value.messages : []
      for (const message of messages) {
        const event = readCommercialEvent(message)
        if (event) events.push(event)
      }
    }
  }

  if (!phoneNumberId) return { ok: false, reason: "ignored" }
  return { ok: true, phoneNumberId, events }
}

export function readWhatsappInboundMessages(body: unknown):
  | { ok: true; phoneNumberId: string; messages: WhatsappInboundMessage[] }
  | { ok: false; reason: "ignored" | "mixed_number" } {
  const root = asRecord(body)
  if (!root || root.object !== "whatsapp_business_account") {
    return { ok: false, reason: "ignored" }
  }
  const entries = Array.isArray(root.entry) ? root.entry : []
  let phoneNumberId = ""
  const messages: WhatsappInboundMessage[] = []

  for (const entry of entries) {
    const changes = asRecord(entry)?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value)
      const metadata = asRecord(value?.metadata)
      const currentPhone =
        typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id.trim() : ""
      if (!currentPhone) continue
      if (!phoneNumberId) phoneNumberId = currentPhone
      if (currentPhone !== phoneNumberId) return { ok: false, reason: "mixed_number" }
      const inbound = Array.isArray(value?.messages) ? value.messages : []
      for (const message of inbound) {
        const parsed = readInboundMessage(message)
        if (parsed) messages.push(parsed)
      }
    }
  }

  if (!phoneNumberId) return { ok: false, reason: "ignored" }
  return { ok: true, phoneNumberId, messages }
}

function readInboundMessage(value: unknown): WhatsappInboundMessage | null {
  const message = asRecord(value)
  if (!message) return null
  const externalMessageId = typeof message.id === "string" ? message.id.trim() : ""
  const from = typeof message.from === "string" ? message.from.trim() : ""
  if (!externalMessageId || !from) return null
  const interactive = asRecord(message.interactive)
  const button = asRecord(interactive?.button_reply)
  const list = asRecord(interactive?.list_reply)
  const buttonId =
    typeof button?.id === "string"
      ? button.id.trim()
      : typeof list?.id === "string"
        ? list.id.trim()
        : ""
  const textBody = asRecord(message.text)
  const text = typeof textBody?.body === "string" ? textBody.body : null
  if (!buttonId && text == null) return null
  return {
    externalMessageId,
    from,
    text,
    buttonId: buttonId || null,
  }
}

function readCommercialEvent(value: unknown): WhatsappCommercialEvent | null {
  const message = asRecord(value)
  if (!message) return null
  const externalMessageId = typeof message.id === "string" ? message.id.trim() : ""
  const from = typeof message.from === "string" ? message.from.trim() : ""
  const offer = readOffer(message)
  if (!externalMessageId || !from || !offer) return null
  return { externalMessageId, from, offer }
}

function readOffer(message: Record<string, unknown>): TvPlanKind | null {
  const interactive = asRecord(message.interactive)
  const button = asRecord(interactive?.button_reply)
  const list = asRecord(interactive?.list_reply)
  const id =
    typeof button?.id === "string"
      ? button.id.trim()
      : typeof list?.id === "string"
        ? list.id.trim()
        : ""
  if (!OFFERS.has(id as TvPlanKind)) return null
  return id as TvPlanKind
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}
