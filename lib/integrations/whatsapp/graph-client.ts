export type WhatsappSendConfig = {
  accessToken: string
  phoneNumberId: string
  graphVersion: string
}

export const WHATSAPP_GRAPH_TIMEOUT_MS = 15_000

export type WhatsappSendResult =
  | { ok: true; sent: true; messageId: string }
  | {
      ok: false
      sent: false
      reason: "not_configured" | "meta_error" | "invalid_response" | "unknown"
      status?: number
      message: string
    }

export type WhatsappReplyButton = {
  id: string
  title: string
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

export function readWhatsappSendConfig(env: NodeJS.ProcessEnv): WhatsappSendConfig | null {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim() ?? ""
  const phoneNumberId = env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID?.trim() ?? ""
  const graphVersion = env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v21.0"
  if (!accessToken || !phoneNumberId || !/^v\d+\.\d+$/.test(graphVersion)) return null
  return { accessToken, phoneNumberId, graphVersion }
}

export async function sendWhatsappText(input: {
  config: WhatsappSendConfig | null
  to: string
  body: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<WhatsappSendResult> {
  return sendWhatsappMessage({
    config: input.config,
    to: input.to,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: { preview_url: false, body: input.body },
    },
  })
}

export async function sendWhatsappImage(input: {
  config: WhatsappSendConfig | null
  to: string
  link: string
  caption?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<WhatsappSendResult> {
  let link: string
  try {
    const url = new URL(input.link)
    if (url.protocol !== "https:") {
      return {
        ok: false,
        sent: false,
        reason: "invalid_response",
        message: "La imagen comercial necesita un enlace HTTPS.",
      }
    }
    link = url.toString()
  } catch {
    return {
      ok: false,
      sent: false,
      reason: "invalid_response",
      message: "La imagen comercial no tiene un enlace válido.",
    }
  }
  return sendWhatsappMessage({
    config: input.config,
    to: input.to,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "image",
      image: { link, caption: input.caption ?? "" },
    },
  })
}

export async function sendWhatsappReplyButtons(input: {
  config: WhatsappSendConfig | null
  to: string
  body: string
  buttons: readonly WhatsappReplyButton[]
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<WhatsappSendResult> {
  if (input.buttons.length < 1 || input.buttons.length > 3) {
    return {
      ok: false,
      sent: false,
      reason: "invalid_response",
      message: "Las opciones de WhatsApp admiten entre 1 y 3 botones.",
    }
  }
  if (input.buttons.some((button) => button.title.trim().length === 0 || button.title.trim().length > 20)) {
    return {
      ok: false,
      sent: false,
      reason: "invalid_response",
      message: "El título de una opción supera el límite de WhatsApp.",
    }
  }
  return sendWhatsappMessage({
    config: input.config,
    to: input.to,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: input.body },
        action: {
          buttons: input.buttons.map((button) => ({
            type: "reply",
            reply: { id: button.id, title: button.title.trim() },
          })),
        },
      },
    },
  })
}

async function sendWhatsappMessage(input: {
  config: WhatsappSendConfig | null
  to: string
  payload: Record<string, unknown>
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<WhatsappSendResult> {
  if (!input.config || !input.to.trim()) {
    return {
      ok: false,
      sent: false,
      reason: "not_configured",
      message: "WhatsApp no está configurado para enviar mensajes.",
    }
  }
  const fetchImpl = input.fetchImpl ?? defaultFetch
  const version = input.config.graphVersion
  const phoneNumberId = input.config.phoneNumberId
  const timeoutMs = input.timeoutMs ?? WHATSAPP_GRAPH_TIMEOUT_MS
  let response: Awaited<ReturnType<FetchLike>>
  try {
    response = await fetchImpl(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input.payload),
        signal: AbortSignal.timeout(timeoutMs),
      }
    )
  } catch (error) {
    return {
      ok: false,
      sent: false,
      reason: "unknown",
      message: unknownDeliveryMessage(error),
    }
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    return {
      ok: false,
      sent: false,
      reason: "meta_error",
      status: response.status,
      message: metaErrorMessage(body),
    }
  }
  const messageId = readMessageId(body)
  if (!messageId) {
    return {
      ok: false,
      sent: false,
      reason: "invalid_response",
      status: response.status,
      message: "WhatsApp no confirmó el identificador del mensaje.",
    }
  }
  return { ok: true, sent: true, messageId }
}

function unknownDeliveryMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ""
  if (name === "AbortError" || name === "TimeoutError") {
    return "La API de WhatsApp no respondió a tiempo. No se sabe si aceptó el mensaje."
  }
  return "No se pudo contactar la API de WhatsApp. No se sabe si aceptó el mensaje."
}

function readMessageId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const messages = (body as { messages?: unknown }).messages
  if (!Array.isArray(messages) || !messages[0] || typeof messages[0] !== "object") return null
  const id = (messages[0] as { id?: unknown }).id
  return typeof id === "string" && id.trim() ? id.trim() : null
}

function metaErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "WhatsApp rechazó el envío."
  }
  const error = (body as { error?: unknown }).error
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return "WhatsApp rechazó el envío."
  }
  const message = (error as { message?: unknown }).message
  return typeof message === "string" && message.trim()
    ? message.trim()
    : "WhatsApp rechazó el envío."
}

const defaultFetch: FetchLike = async (input, init) => {
  const response = await fetch(input, init)
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json() as Promise<unknown>,
  }
}
