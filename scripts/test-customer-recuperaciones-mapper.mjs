import assert from "node:assert/strict"
import test from "node:test"

import {
  mapCreateCustomerRecuperacionPayloadToInsert,
  mapCustomerRecuperacionRowToCustomerRecuperacion,
  mapNewCustomerRecuperacionInputToPayload,
} from "../lib/supabase/customer-recuperaciones.mapper.ts"

const existingRow = {
  id: "recupero-1",
  company_id: "company-1",
  customer_id: "customer-1",
  manual_customer_name: null,
  manual_zone: null,
  manual_phone: null,
  performed_by_employee_id: "employee-1",
  channel: "telefono",
  offer: "Plan promocional 3 meses",
  observation: "Cliente interesado en volver",
  resultado: "interesado",
  created_at: "2026-07-08T12:00:00.000Z",
  updated_at: "2026-07-08T12:00:00.000Z",
  deleted_at: null,
}

const manualRow = {
  ...existingRow,
  id: "recupero-2",
  customer_id: null,
  manual_customer_name: "Juan Pérez",
  manual_zone: "Centro",
  manual_phone: "3515551234",
  resultado: "volver_a_contactar",
}

test("mapper convierte fila de customer_recuperaciones al dominio", () => {
  const mapped = mapCustomerRecuperacionRowToCustomerRecuperacion(existingRow)

  assert.equal(mapped.customerId, "customer-1")
  assert.equal(mapped.manualCustomerName, null)
  assert.equal(mapped.channel, "telefono")
  assert.equal(mapped.resultado, "interesado")
})

test("mapper soporta carga manual con campos manuales", () => {
  const mapped = mapCustomerRecuperacionRowToCustomerRecuperacion(manualRow)

  assert.equal(mapped.customerId, null)
  assert.equal(mapped.manualCustomerName, "Juan Pérez")
  assert.equal(mapped.manualZone, "Centro")
  assert.equal(mapped.manualPhone, "3515551234")
})

test("payload de cliente existente deja campos manuales en null", () => {
  const payload = mapNewCustomerRecuperacionInputToPayload(
    {
      mode: "existing",
      customerId: "customer-1",
      channel: "whatsapp",
      offer: "Descuento 20%",
      observation: "Oferta enviada",
      resultado: "no_responde",
    },
    "company-1",
    "employee-1"
  )

  const insert = mapCreateCustomerRecuperacionPayloadToInsert(payload)

  assert.equal(insert.customer_id, "customer-1")
  assert.equal(insert.manual_customer_name, null)
  assert.equal(insert.manual_zone, null)
  assert.equal(insert.manual_phone, null)
  assert.equal(insert.performed_by_employee_id, "employee-1")
})

test("payload de carga manual no referencia customer_id", () => {
  const payload = mapNewCustomerRecuperacionInputToPayload(
    {
      mode: "manual",
      manualCustomerName: "María López",
      manualZone: "Norte",
      manualPhone: "3515559876",
      channel: "otro",
      offer: "Plan básico",
      observation: "Sin respuesta",
      resultado: "no_interesado",
    },
    "company-1",
    "employee-1"
  )

  const insert = mapCreateCustomerRecuperacionPayloadToInsert(payload)

  assert.equal(insert.customer_id, null)
  assert.equal(insert.manual_customer_name, "María López")
  assert.equal(insert.manual_zone, "Norte")
  assert.equal(insert.manual_phone, "3515559876")
})
