import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { sendWhatsappText } from "../lib/integrations/whatsapp/graph-client.ts"
import { webhookRetryForReceipt, whatsappOptOutKey } from "../lib/integrations/whatsapp/message-ledger.ts"
import {
  interpretWhatsappIntent,
  planWhatsappCommercialTurn,
} from "../lib/subscriptions/whatsapp-commercial-bot.ts"
import { resolveRepeatedWhatsappAcceptance } from "../lib/subscriptions/whatsapp-commercial-requests.ts"
import { deliverWhatsappReplies } from "../lib/subscriptions/whatsapp-outbound-delivery.ts"

const root = resolve(import.meta.dirname, "..")
const catalog = { packMonthlyPrice: null, fullMonthlyPrice: null }

function memoryLedger() {
  const rows = new Set()
  const rowKey = (companyId, key) => `${companyId}\n${key}`
  return {
    async has(companyId, key) {
      return rows.has(rowKey(companyId, key)) ? "seen" : "missing"
    },
    async claim(companyId, key) {
      const row = rowKey(companyId, key)
      if (rows.has(row)) return "duplicate"
      rows.add(row)
      return "new"
    },
    async release(companyId, key) {
      rows.delete(rowKey(companyId, key))
      return "released"
    },
    async list(companyId, prefix) {
      const keys = []
      for (const row of rows) {
        const separator = row.indexOf("\n")
        const company = row.slice(0, separator)
        const key = row.slice(separator + 1)
        if (company === companyId && key.startsWith(prefix)) keys.push(key)
      }
      return { ok: true, keys }
    },
  }
}

function textReply(body) {
  return { type: "text", body }
}

test("dos webhooks simultáneos con el mismo mensaje envían una sola vez", async () => {
  const ledger = memoryLedger()
  let calls = 0
  const send = async () => {
    calls += 1
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20))
    return { ok: true, sent: true, messageId: "wamid.out.1" }
  }
  const input = {
    companyId: "empresa-a",
    inboundId: "wamid.in.1",
    replies: [textReply("Hola")],
    ledger,
    send,
  }
  const [first, second] = await Promise.all([
    deliverWhatsappReplies(input),
    deliverWhatsappReplies(input),
  ])
  assert.equal(calls, 1)
  const states = [first, second].map((result) => result.slots[0]?.state).sort()
  assert.deepEqual(states, ["ambiguous", "confirmed"])
  assert.equal(first.retry || second.retry, false)
})

test("el reintento del mismo mensaje no reenvía un tramo ya confirmado", async () => {
  const ledger = memoryLedger()
  let calls = 0
  const send = async () => {
    calls += 1
    return { ok: true, sent: true, messageId: "wamid.out.2" }
  }
  const input = {
    companyId: "empresa-a",
    inboundId: "wamid.in.2",
    replies: [textReply("Hola")],
    ledger,
    send,
  }
  const first = await deliverWhatsappReplies(input)
  const retry = await deliverWhatsappReplies(input)
  assert.equal(first.slots[0].state, "confirmed")
  assert.equal(first.slots[0].messageId, "wamid.out.2")
  assert.equal(retry.slots[0].state, "already_confirmed")
  assert.equal(retry.slots[0].messageId, "wamid.out.2")
  assert.equal(retry.retry, false)
  assert.equal(calls, 1)
})

test("sin token el webhook responde error reintentable antes de procesar", () => {
  const route = readFileSync(resolve(root, "app/api/integrations/whatsapp/webhook/route.ts"), "utf8")
  const gate = route.indexOf("readWhatsappSendConfig")
  const handle = route.indexOf("handleWhatsappInboundMessage")
  assert.ok(gate > -1 && handle > gate)
  assert.match(route, /status: 503/)
  const session = readFileSync(
    resolve(root, "lib/subscriptions/whatsapp-commercial-session.ts"),
    "utf8"
  )
  const sessionGate = session.indexOf("readWhatsappSendConfig")
  const register = session.indexOf("registerWhatsappCommercialRequest")
  assert.ok(sessionGate > -1 && register > sessionGate)
})

test("un error al consultar el recibo no se trata como mensaje nuevo", () => {
  assert.equal(webhookRetryForReceipt("unavailable"), "retry")
  assert.equal(webhookRetryForReceipt("missing"), "continue")
  assert.equal(webhookRetryForReceipt("seen"), "stop")
})

test("si no se puede leer el recibo no se envía", async () => {
  let calls = 0
  const result = await deliverWhatsappReplies({
    companyId: "empresa-a",
    inboundId: "wamid.in.3",
    replies: [textReply("Hola")],
    ledger: {
      async has() {
        return "unavailable"
      },
      async claim() {
        throw new Error("no debe reservar")
      },
      async release() {
        throw new Error("no debe borrar")
      },
      async list() {
        return { ok: false }
      },
    },
    send: async () => {
      calls += 1
      return { ok: true, sent: true, messageId: "wamid.no" }
    },
  })
  assert.equal(calls, 0)
  assert.equal(result.retry, true)
  assert.deepEqual(result.slots, [])
})

test("un error HTTP de Meta se puede reintentar y un timeout no", async () => {
  const secret = "token-secreto"
  const failed = await sendWhatsappText({
    config: { accessToken: secret, phoneNumberId: "1099", graphVersion: "v21.0" },
    to: "5493510000000",
    body: "Hola",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Invalid OAuth access token." } }),
    }),
  })
  assert.equal(failed.reason, "meta_error")
  assert.equal(failed.sent, false)

  const timedOut = await sendWhatsappText({
    config: { accessToken: secret, phoneNumberId: "1099", graphVersion: "v21.0" },
    to: "5493510000000",
    body: "Hola",
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("timeout")
          error.name = "TimeoutError"
          reject(error)
        })
      }),
  })
  assert.equal(timedOut.sent, false)
  assert.equal(timedOut.reason, "unknown")
  assert.match(timedOut.message, /No se sabe si/)
  assert.doesNotMatch(timedOut.message, /token-secreto/)

  const ledger = memoryLedger()
  let calls = 0
  const send = async () => {
    calls += 1
    return { ok: false, sent: false, reason: "unknown", message: "No se sabe si aceptó el mensaje." }
  }
  const input = {
    companyId: "empresa-a",
    inboundId: "wamid.in.4",
    replies: [textReply("Hola")],
    ledger,
    send,
  }
  const first = await deliverWhatsappReplies(input)
  const second = await deliverWhatsappReplies(input)
  assert.equal(first.retry, false)
  assert.equal(first.slots[0].state, "ambiguous")
  assert.equal(first.slots[0].messageId, null)
  assert.equal(second.slots[0].state, "ambiguous")
  assert.equal(calls, 1)
})

test("un envío parcial no reenvía el tramo ya confirmado", async () => {
  const ledger = memoryLedger()
  const replies = [
    textReply("texto"),
    { type: "image", link: "https://cdn.example.com/oferta.png", caption: "oferta" },
    { type: "buttons", body: "opciones", buttons: [{ id: "offer:pack", title: "Pack Fútbol" }] },
  ]
  let calls = []
  let imageAttempts = 0
  const send = async (reply) => {
    calls.push(reply.type)
    if (reply.type === "image") {
      imageAttempts += 1
      if (imageAttempts === 1) {
        return { ok: false, sent: false, reason: "meta_error", status: 400, message: "imagen rechazada" }
      }
    }
    return { ok: true, sent: true, messageId: `wamid.${reply.type}` }
  }
  const first = await deliverWhatsappReplies({
    companyId: "empresa-a",
    inboundId: "wamid.in.5",
    replies,
    ledger,
    send,
  })
  assert.deepEqual(calls, ["text", "image"])
  assert.equal(first.retry, true)
  assert.equal(first.slots[0].messageId, "wamid.text")
  assert.equal(first.slots[1].state, "rejected")

  calls = []
  const retry = await deliverWhatsappReplies({
    companyId: "empresa-a",
    inboundId: "wamid.in.5",
    replies,
    ledger,
    send,
  })
  assert.deepEqual(calls, ["image", "buttons"])
  assert.equal(retry.slots[0].state, "already_confirmed")
  assert.equal(retry.slots[0].messageId, "wamid.text")
  assert.equal(retry.slots[1].messageId, "wamid.image")
  assert.equal(retry.slots[2].messageId, "wamid.buttons")
  assert.equal(retry.retry, false)
})

test("baja, stop y equivalentes no vuelven a ofrecer planes", () => {
  for (const text of ["BAJA", "stop", "STOP", "parar", "no quiero mensajes", "dejar de recibir"]) {
    assert.equal(interpretWhatsappIntent({ kind: "text", text }).type, "opt_out")
  }
  assert.equal(interpretWhatsappIntent({ kind: "text", text: "baja del pack" }).type, "offer")
  const optedOut = planWhatsappCommercialTurn({
    message: { kind: "text", text: "baja" },
    identity: "unique",
    service: "ready",
    catalog,
    personalizedQuote: null,
    imageLink: "https://cdn.example.com/oferta.png",
  })
  assert.equal(optedOut.acceptance, null)
  assert.equal(optedOut.replies.length, 1)
  assert.equal(optedOut.replies[0].type, "text")
  assert.doesNotMatch(optedOut.replies[0].body, /Acepto|precio|Pack|Full/)

  const silenced = planWhatsappCommercialTurn({
    message: { kind: "text", text: "hola" },
    identity: "unique",
    service: "ready",
    catalog,
    personalizedQuote: null,
    imageLink: "https://cdn.example.com/oferta.png",
    suppressOffers: true,
  })
  assert.equal(silenced.acceptance, null)
  assert.equal(silenced.replies.length, 1)
  assert.equal(silenced.replies[0].type, "text")
})

test("una aceptación repetida reutiliza la solicitud abierta y no mezcla empresas ni fichas", () => {
  const ambiguous = {
    companyId: "empresa-a",
    originPhone: "5493510000000",
    offer: "pack",
    status: "pending",
    customerId: null,
  }
  assert.equal(
    resolveRepeatedWhatsappAcceptance({
      companyId: "empresa-a",
      originPhone: "5493510000000",
      offer: "pack",
      existing: ambiguous,
    }),
    "reuse"
  )
  assert.equal(ambiguous.customerId, null)
  assert.equal(
    resolveRepeatedWhatsappAcceptance({
      companyId: "empresa-a",
      originPhone: "5493510000000",
      offer: "pack",
      existing: { ...ambiguous, status: "completed" },
    }),
    "create"
  )
  assert.equal(
    resolveRepeatedWhatsappAcceptance({
      companyId: "empresa-a",
      originPhone: "5493510000000",
      offer: "pack",
      existing: { ...ambiguous, status: "rejected" },
    }),
    "create"
  )
  assert.equal(
    resolveRepeatedWhatsappAcceptance({
      companyId: "empresa-b",
      originPhone: "5493510000000",
      offer: "pack",
      existing: ambiguous,
    }),
    "create"
  )
  assert.equal(
    resolveRepeatedWhatsappAcceptance({
      companyId: "empresa-a",
      originPhone: "5493510000000",
      offer: "full",
      existing: ambiguous,
    }),
    "create"
  )
})

test("la reserva y la baja comercial quedan aisladas por empresa", async () => {
  const ledger = memoryLedger()
  await ledger.claim("empresa-a", whatsappOptOutKey("5493510000000"))
  const own = await ledger.list("empresa-a", whatsappOptOutKey("5493510000000"))
  const other = await ledger.list("empresa-b", whatsappOptOutKey("5493510000000"))
  assert.equal(own.keys.length, 1)
  assert.equal(other.keys.length, 0)

  let calls = 0
  const send = async () => {
    calls += 1
    return { ok: true, sent: true, messageId: "wamid.empresa" }
  }
  await deliverWhatsappReplies({
    companyId: "empresa-a",
    inboundId: "wamid.in.6",
    replies: [textReply("Hola")],
    ledger,
    send,
  })
  await deliverWhatsappReplies({
    companyId: "empresa-b",
    inboundId: "wamid.in.6",
    replies: [textReply("Hola")],
    ledger,
    send,
  })
  assert.equal(calls, 2)
})

test("la búsqueda de teléfonos sigue normalizando y no usa un filtro parcial", () => {
  const source = readFileSync(
    resolve(root, "lib/supabase/whatsapp-commercial-requests.queries.ts"),
    "utf8"
  )
  const start = source.indexOf("export async function listWhatsappIdentityContacts")
  const end = source.indexOf("export async function listWhatsappRequestsForCustomer")
  const fn = source.slice(start, end)
  assert.match(fn, /normalizeWhatsappOriginPhone/)
  assert.match(fn, /\.eq\("company_id", companyId\)/)
  assert.match(fn, /\.is\("deleted_at", null\)/)
  assert.doesNotMatch(fn, /\.ilike\(|\.like\(/)
})
