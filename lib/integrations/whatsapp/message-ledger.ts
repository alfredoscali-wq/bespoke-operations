export function whatsappSlotKey(inboundId: string, index: number): string {
  return `slot|${inboundId}|${index}`
}

export function whatsappConfirmedMarker(inboundId: string, index: number): string {
  return `confirmed|${inboundId}|${index}`
}

export function whatsappConfirmedPrefix(inboundId: string, index: number): string {
  return `confirmed|${inboundId}|${index}|`
}

export function whatsappConfirmedKey(inboundId: string, index: number, metaMessageId: string): string {
  return `${whatsappConfirmedPrefix(inboundId, index)}${metaMessageId}`
}

export function whatsappDoneKey(inboundId: string): string {
  return `done|${inboundId}`
}

export function whatsappOptOutKey(normalizedPhone: string): string {
  return `optout|${normalizedPhone}`
}

export function readWhatsappConfirmedMessageId(key: string, prefix: string): string | null {
  if (!key.startsWith(prefix)) return null
  const id = key.slice(prefix.length).trim()
  return id || null
}

export function webhookRetryForReceipt(
  seen: "seen" | "missing" | "unavailable"
): "retry" | "stop" | "continue" {
  if (seen === "unavailable") return "retry"
  if (seen === "seen") return "stop"
  return "continue"
}
