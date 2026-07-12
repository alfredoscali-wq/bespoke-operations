import assert from "node:assert/strict"
import test from "node:test"

import {
  mapCreateCustomerAtencionPayloadToInsert,
  mapCustomerAtencionRowToCustomerAtencion,
} from "../lib/supabase/customer-atenciones.mapper.ts"
import {
  CUSTOMER_ATENCION_SPRINT_1_0_RESULTADO,
} from "../lib/types/customer-atenciones.ts"

const sampleRow = {
  id: "atencion-1",
  company_id: "company-1",
  customer_id: "customer-1",
  attended_by_employee_id: "employee-1",
  channel: "whatsapp",
  motivo: "consulta",
  detail: "Consulta por factura",
  resolution: "Se explicó el detalle de la factura",
  resultado: "resuelta",
  status: "resuelta",
  next_step: null,
  active_management_employee_id: null,
  active_management_started_at: null,
  created_at: "2026-07-08T12:00:00.000Z",
  updated_at: "2026-07-08T12:00:00.000Z",
  deleted_at: null,
}

test("mapper convierte fila de customer_atenciones al dominio", () => {
  const mapped = mapCustomerAtencionRowToCustomerAtencion(sampleRow)

  assert.equal(mapped.id, "atencion-1")
  assert.equal(mapped.companyId, "company-1")
  assert.equal(mapped.customerId, "customer-1")
  assert.equal(mapped.channel, "whatsapp")
  assert.equal(mapped.motivo, "consulta")
  assert.equal(mapped.resultado, "resuelta")
  assert.equal(mapped.status, "resuelta")
  assert.equal(mapped.nextStep, null)
})

test("insert del sprint 2.0 deriva status resuelta y next_step null", () => {
  const insert = mapCreateCustomerAtencionPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    attendedByEmployeeId: "employee-1",
    channel: "telefono",
    motivo: "reclamo",
    detail: "Cliente reclama demora",
    resolution: "Se coordinó visita técnica",
  })

  assert.equal(insert.resultado, CUSTOMER_ATENCION_SPRINT_1_0_RESULTADO)
  assert.equal(insert.resultado, "resuelta")
  assert.equal(insert.status, "resuelta")
  assert.equal(insert.next_step, null)
  assert.equal(insert.company_id, "company-1")
  assert.equal(insert.detail, "Cliente reclama demora")
})

test("insert con requiere_seguimiento deriva status pendiente", () => {
  const insert = mapCreateCustomerAtencionPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    attendedByEmployeeId: "employee-1",
    channel: "telefono",
    motivo: "consulta",
    detail: "Callback",
    resolution: "Programado",
    resultado: "requiere_seguimiento",
  })

  assert.equal(insert.status, "pendiente")
})

test("mapper normaliza valores desconocidos con defaults seguros", () => {
  const mapped = mapCustomerAtencionRowToCustomerAtencion({
    ...sampleRow,
    channel: "invalid",
    motivo: "invalid",
    resultado: "invalid",
  })

  assert.equal(mapped.channel, "otro")
  assert.equal(mapped.motivo, "otro")
  assert.equal(mapped.resultado, "resuelta")
})
