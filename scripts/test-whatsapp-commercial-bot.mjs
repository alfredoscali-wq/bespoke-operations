import assert from "node:assert/strict"
import test from "node:test"

import { readWhatsappCommercialImageLink } from "../lib/integrations/whatsapp/commercial-image.ts"
import {
  readWhatsappSendConfig,
  sendWhatsappImage,
  sendWhatsappText,
} from "../lib/integrations/whatsapp/graph-client.ts"
import { planWhatsappCommercialTurn } from "../lib/subscriptions/whatsapp-commercial-bot.ts"
import {
  deliverWhatsappCommercialTurn,
  whatsappPersonalizedQuote,
  whatsappServiceState,
} from "../lib/subscriptions/whatsapp-commercial-turn.ts"
import { formatTvMoney } from "../lib/subscriptions/tv-plans.ts"

const catalog = { packMonthlyPrice: 6000, fullMonthlyPrice: 8000 }

function service(id = "service-1") {
  return {
    serviceId: id,
    includedTvCode: "TV-BASICO",
    listPrice: 18000,
    catalogMonthlyPrice: 18000,
    conditionCode: null,
    discountPercent: null,
    activeComponents: [],
    catalogComponents: [
      { code: "PACK-FUTBOL", unitPrice: 6000, isRecurring: true },
      { code: "TV-FULL-UPGRADE", unitPrice: 8000, isRecurring: true },
    ],
  }
}

function textsOf(plan) {
  return plan.replies.flatMap((reply) => {
    if (reply.type === "text" || reply.type === "buttons") return [reply.body]
    return [reply.caption]
  })
}

test("el saludo presenta las opciones y no inventa una imagen", () => {
  const plan = planWhatsappCommercialTurn({
    message: { kind: "text", text: "Hola" },
    identity: "none",
    service: "unavailable",
    catalog,
    personalizedQuote: null,
    imageLink: readWhatsappCommercialImageLink(""),
  })
  assert.equal(plan.acceptance, null)
  assert.equal(plan.replies.some((reply) => reply.type === "image"), false)
  const buttons = plan.replies.find((reply) => reply.type === "buttons")
  assert.ok(buttons)
  assert.deepEqual(
    buttons.buttons.map((button) => button.id),
    ["offer:pack", "offer:full", "prices"]
  )
  assert.match(buttons.body, /Pack Fútbol/)
  assert.match(buttons.body, /TV Full/)
  assert.doesNotMatch(buttons.body, /mensaje enviado|plan cambiado/i)
})

test("la pregunta comercial usa el catálogo y la cotización personal solo si la identidad es única", () => {
  const personal = whatsappPersonalizedQuote("pack", [service()])
  assert.ok(personal)
  assert.notEqual(personal.monthlyFee, catalog.packMonthlyPrice)
  const personalText = formatTvMoney(personal.monthlyFee)

  const prices = planWhatsappCommercialTurn({
    message: { kind: "text", text: "¿Cuánto sale el Pack?" },
    identity: "none",
    service: "unavailable",
    catalog,
    personalizedQuote: null,
    imageLink: null,
  })
  assert.match(textsOf(prices).join("\n"), /6\.?000/)
  assert.doesNotMatch(textsOf(prices).join("\n"), /4500|7500|9900/)

  const linked = planWhatsappCommercialTurn({
    message: { kind: "button", id: "offer:pack" },
    identity: "unique",
    service: "ready",
    catalog,
    personalizedQuote: personal,
    imageLink: "https://cdn.example.com/oferta.png",
  })
  assert.match(textsOf(linked).join("\n"), new RegExp(personalText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.equal(linked.replies[0].type, "image")

  const shared = planWhatsappCommercialTurn({
    message: { kind: "button", id: "offer:pack" },
    identity: "ambiguous",
    service: "ambiguous",
    catalog,
    personalizedQuote: personal,
    imageLink: null,
  })
  assert.equal(shared.acceptance, null)
  assert.doesNotMatch(textsOf(shared).join("\n"), new RegExp(personalText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(textsOf(shared).join("\n"), /revis/)

  assert.equal(whatsappServiceState([service("a"), service("b")]), "ambiguous")
  const manyServices = planWhatsappCommercialTurn({
    message: { kind: "text", text: "quiero full" },
    identity: "unique",
    service: "ambiguous",
    catalog,
    personalizedQuote: personal,
    imageLink: null,
  })
  assert.equal(manyServices.acceptance, null)
  assert.match(textsOf(manyServices).join("\n"), /revis/)
  assert.doesNotMatch(textsOf(manyServices).join("\n"), /30111222/)
})

test("la aceptación queda pendiente y un reintento ya procesado no vuelve a enviar", async () => {
  const plan = planWhatsappCommercialTurn({
    message: { kind: "button", id: "accept:pack" },
    identity: "ambiguous",
    service: "unavailable",
    catalog,
    personalizedQuote: null,
    imageLink: null,
  })
  assert.deepEqual(plan.acceptance, { offer: "pack" })
  assert.match(plan.confirmation, /solicitud pendiente/)
  assert.doesNotMatch(textsOf(plan).join("\n"), /Dejé registrada/)

  const sent = []
  let registrations = 0
  const first = await deliverWhatsappCommercialTurn({
    alreadyProcessed: false,
    plan,
    registerAcceptance: async () => {
      registrations += 1
      return { ok: true, duplicate: false }
    },
    send: async (reply) => {
      sent.push(reply)
      return { ok: true, sent: true, messageId: "wamid.out.1" }
    },
  })
  assert.equal(first.registered, true)
  assert.equal(first.outboundConfirmed, true)
  assert.equal(registrations, 1)
  assert.match(sent.map((reply) => reply.body).join("\n"), /solicitud pendiente/)
  assert.doesNotMatch(sent.map((reply) => reply.body ?? reply.caption ?? "").join("\n"), /plan cambiado/i)

  const retry = await deliverWhatsappCommercialTurn({
    alreadyProcessed: true,
    plan,
    registerAcceptance: async () => {
      throw new Error("no debe registrar de nuevo")
    },
    send: async () => {
      throw new Error("no debe enviar de nuevo")
    },
  })
  assert.equal(retry.duplicate, true)
  assert.equal(retry.outboundConfirmed, false)
  assert.deepEqual(retry.sends, [])
})

test("un error de Meta no confirma el envío y sin configuración no llama a la API", async () => {
  assert.equal(readWhatsappSendConfig({}), null)
  let called = false
  const skipped = await sendWhatsappText({
    config: null,
    to: "5493515551234",
    body: "Hola",
    fetchImpl: async () => {
      called = true
      throw new Error("no")
    },
  })
  assert.equal(called, false)
  assert.equal(skipped.sent, false)
  assert.equal(skipped.reason, "not_configured")

  const secret = "token-secreto"
  const failed = await sendWhatsappText({
    config: { accessToken: secret, phoneNumberId: "1099", graphVersion: "v21.0" },
    to: "5493515551234",
    body: "Hola",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Invalid OAuth access token.", code: 190 } }),
    }),
  })
  assert.equal(failed.sent, false)
  assert.equal(failed.reason, "meta_error")
  assert.equal(failed.status, 401)
  assert.doesNotMatch(failed.message, /token-secreto/)

  const sent = await sendWhatsappImage({
    config: { accessToken: secret, phoneNumberId: "1099", graphVersion: "v21.0" },
    to: "5493515551234",
    link: "https://cdn.example.com/oferta.png",
    caption: "Oferta",
    fetchImpl: async (_url, init) => {
      const payload = JSON.parse(init.body)
      assert.equal(payload.type, "image")
      assert.equal(payload.image.link, "https://cdn.example.com/oferta.png")
      assert.doesNotMatch(init.body, /token-secreto/)
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.img.1" }] }) }
    },
  })
  assert.deepEqual(sent, { ok: true, sent: true, messageId: "wamid.img.1" })

  const blocked = await sendWhatsappImage({
    config: { accessToken: secret, phoneNumberId: "1099", graphVersion: "v21.0" },
    to: "5493515551234",
    link: "http://cdn.example.com/oferta.png",
    fetchImpl: async () => {
      throw new Error("no debe enviar")
    },
  })
  assert.equal(blocked.sent, false)
})
