import assert from "node:assert/strict"
import test from "node:test"

import { ACTIVITY_ACTIONS } from "../lib/activity-engine/activity-actions.ts"
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
} from "../lib/activity-engine/activity-types.ts"
import { buildCustomerInteractionActivity } from "../lib/customer-atenciones/customer-activity-events.ts"
import {
  buildCustomerInteractionActivityDescription,
  buildCustomerInteractionActivityTitle,
  buildCustomerInteractionHistorialDetail,
  getCustomerInteractionResultOptions,
  validateCustomerInteractionInput,
} from "../lib/customer-atenciones/customer-interaction-catalog.ts"

test("1.1C: CUSTOMER_INTERACTION en catálogo", () => {
  assert.equal(ACTIVITY_ACTIONS.CUSTOMER_INTERACTION, "CUSTOMER_INTERACTION")
})

test("1.1C: resultados dependen del medio", () => {
  const phone = getCustomerInteractionResultOptions("llamada_telefonica")
  assert.ok(phone.some((o) => o.value === "no_respondio"))
  assert.ok(phone.some((o) => o.value === "contacto_exitoso"))

  const wa = getCustomerInteractionResultOptions("whatsapp")
  assert.deepEqual(
    wa.map((o) => o.value),
    ["enviado", "leido", "respondido", "sin_respuesta"]
  )

  const email = getCustomerInteractionResultOptions("email")
  assert.deepEqual(
    email.map((o) => o.value),
    ["enviado", "respondido", "rebotado"]
  )
})

test("1.1C: validación de interacción", () => {
  const ok = validateCustomerInteractionInput({
    medium: "llamada_telefonica",
    result: "no_respondio",
    observations: "Se intentará nuevamente mañana.",
  })
  assert.ok(!("error" in ok))
  if (!("error" in ok)) {
    assert.equal(ok.medium, "llamada_telefonica")
    assert.equal(ok.result, "no_respondio")
  }

  const badMedium = validateCustomerInteractionInput({
    medium: "fax",
    result: "no_respondio",
  })
  assert.ok("error" in badMedium)

  const badResult = validateCustomerInteractionInput({
    medium: "whatsapp",
    result: "no_respondio",
  })
  assert.ok("error" in badResult)
})

test("1.1C: historial legible", () => {
  const detail = buildCustomerInteractionHistorialDetail({
    medium: "llamada_telefonica",
    result: "no_respondio",
    observations: "Se intentará nuevamente mañana.",
  })
  assert.match(detail, /^Llamada telefónica/)
  assert.match(detail, /Resultado:\nNo respondió/)
  assert.match(detail, /Observación:\nSe intentará nuevamente mañana\./)
})

test("1.1C: title / description / activity builder", () => {
  assert.equal(
    buildCustomerInteractionActivityTitle("llamada_telefonica"),
    "Llamada realizada"
  )
  assert.equal(
    buildCustomerInteractionActivityTitle("whatsapp"),
    "WhatsApp enviado"
  )
  assert.equal(
    buildCustomerInteractionActivityTitle("email"),
    "Correo enviado"
  )

  const description = buildCustomerInteractionActivityDescription({
    employeeName: "María Gómez",
    medium: "llamada_telefonica",
    result: "no_respondio",
  })
  assert.equal(
    description,
    "María Gómez realizó una llamada telefónica. Resultado: No respondió."
  )

  const payload = buildCustomerInteractionActivity({
    title: "Llamada realizada",
    description,
    medio: "llamada_telefonica",
    resultado: "no_respondio",
    nextStep: "seguimiento_cliente",
    expedienteId: "exp-1",
    customerId: "cust-1",
  })
  assert.equal(payload.action, ACTIVITY_ACTIONS.CUSTOMER_INTERACTION)
  assert.equal(payload.category, ACTIVITY_CATEGORIES.CONTACT)
  assert.equal(payload.impact, ACTIVITY_IMPACTS.ACTIVITY)
  assert.equal(payload.metadata.medio, "llamada_telefonica")
  assert.equal(payload.metadata.resultado, "no_respondio")
  assert.equal(payload.metadata.expediente, "exp-1")
  assert.equal(payload.metadata.customer_id, "cust-1")
  assert.equal(payload.metadata.next_step, "seguimiento_cliente")
})
