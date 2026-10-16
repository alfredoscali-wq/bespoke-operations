import type { WhatsappSendResult } from "@/lib/integrations/whatsapp/graph-client"
import {
  readWhatsappConfirmedMessageId,
  whatsappConfirmedKey,
  whatsappConfirmedMarker,
  whatsappConfirmedPrefix,
  whatsappSlotKey,
} from "@/lib/integrations/whatsapp/message-ledger"
import type { WhatsappOutboundReply } from "@/lib/subscriptions/whatsapp-commercial-bot"

/**
 * Cada respuesta sale con una reserva propia en tv_whatsapp_processed_messages.
 * La clave primaria (company_id, external_message_id) es el único cierre contra
 * dos webhooks simultáneos. No hay un SELECT previo que decida el envío.
 *
 * slot|{wamid}|{índice} se inserta antes de llamar a Graph. Si otro proceso ya
 * lo insertó, este no envía ese tramo.
 * confirmed|{wamid}|{índice}|{id de Meta} se inserta solo cuando Graph devuelve
 * un id no vacío. Ese tramo no se vuelve a enviar.
 *
 * Error HTTP de Meta: se borra el slot y el webhook responde 500. El reintento
 * de Meta vuelve a enviar únicamente los tramos sin confirmación.
 * Timeout, corte de red o respuesta sin id: el slot queda. No se reintenta,
 * porque Meta puede haber aceptado el mensaje y la API no permite saberlo.
 * En ese caso no se afirma que el mensaje se haya entregado una sola vez, ni
 * que se haya entregado. Los tramos posteriores de ese turno tampoco se envían.
 */
export type WhatsappDeliveryLedger = {
  has(companyId: string, key: string): Promise<"seen" | "missing" | "unavailable">
  claim(companyId: string, key: string): Promise<"new" | "duplicate" | "unavailable">
  release(companyId: string, key: string): Promise<"released" | "unavailable">
  list(companyId: string, prefix: string): Promise<{ ok: true; keys: string[] } | { ok: false }>
}

export type WhatsappDeliverySlot = {
  index: number
  state: "confirmed" | "already_confirmed" | "rejected" | "ambiguous"
  messageId: string | null
}

export async function deliverWhatsappReplies(input: {
  companyId: string
  inboundId: string
  replies: readonly WhatsappOutboundReply[]
  ledger: WhatsappDeliveryLedger
  send: (reply: WhatsappOutboundReply) => Promise<WhatsappSendResult>
}): Promise<{ slots: WhatsappDeliverySlot[]; retry: boolean }> {
  const slots: WhatsappDeliverySlot[] = []
  let retry = false
  for (let index = 0; index < input.replies.length; index += 1) {
    const prefix = whatsappConfirmedPrefix(input.inboundId, index)
    const marker = await input.ledger.has(input.companyId, whatsappConfirmedMarker(input.inboundId, index))
    if (marker === "unavailable") {
      retry = true
      break
    }
    if (marker === "seen") {
      const existing = await input.ledger.list(input.companyId, prefix)
      const storedId = existing.ok
        ? existing.keys
            .map((key) => readWhatsappConfirmedMessageId(key, prefix))
            .find((id): id is string => Boolean(id)) ?? null
        : null
      slots.push({ index, state: "already_confirmed", messageId: storedId })
      continue
    }

    const slotKey = whatsappSlotKey(input.inboundId, index)
    const claim = await input.ledger.claim(input.companyId, slotKey)
    if (claim === "unavailable") {
      retry = true
      break
    }
    if (claim === "duplicate") {
      slots.push({ index, state: "ambiguous", messageId: null })
      break
    }

    const result = await input.send(input.replies[index])
    if (result.sent) {
      const marked = await input.ledger.claim(
        input.companyId,
        whatsappConfirmedMarker(input.inboundId, index)
      )
      const saved = await input.ledger.claim(
        input.companyId,
        whatsappConfirmedKey(input.inboundId, index, result.messageId)
      )
      const persisted = marked !== "unavailable" && saved !== "unavailable"
      slots.push({
        index,
        state: persisted ? "confirmed" : "ambiguous",
        messageId: persisted ? result.messageId : null,
      })
      continue
    }

    if (result.reason === "meta_error") {
      await input.ledger.release(input.companyId, slotKey)
      slots.push({ index, state: "rejected", messageId: null })
      retry = true
      break
    }

    if (result.reason === "unknown" || (result.reason === "invalid_response" && result.status != null)) {
      slots.push({ index, state: "ambiguous", messageId: null })
      break
    }

    await input.ledger.release(input.companyId, slotKey)
    slots.push({ index, state: "rejected", messageId: null })
    if (result.reason === "not_configured") retry = true
    break
  }
  return { slots, retry }
}

export function whatsappTurnFullyConfirmed(
  replyCount: number,
  slots: readonly WhatsappDeliverySlot[]
): boolean {
  return (
    replyCount > 0 &&
    slots.length === replyCount &&
    slots.every((slot) => slot.state === "confirmed" || slot.state === "already_confirmed") &&
    slots.every((slot) => Boolean(slot.messageId))
  )
}
