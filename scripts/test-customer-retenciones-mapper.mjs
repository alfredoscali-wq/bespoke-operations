import assert from "node:assert/strict"
import test from "node:test"

import {
  mapCreateCustomerRetencionPayloadToInsert,
  mapCustomerRetencionRowToCustomerRetencion,
  mapUpdateCustomerRetencionCompletePayloadToUpdate,
} from "../lib/supabase/customer-retenciones.mapper.ts"

const sampleRow = {
  id: "retencion-1",
  company_id: "company-1",
  customer_id: "customer-1",
  assigned_employee_id: "employee-1",
  assigned_by_employee_id: "employee-2",
  motivo_baja: "precio_situacion_economica",
  detail: "Cliente consulta por aumento de tarifa",
  status: "pendiente",
  resultado: null,
  resolution: null,
  completed_at: null,
  completed_by_employee_id: null,
  created_at: "2026-07-08T12:00:00.000Z",
  updated_at: "2026-07-08T12:00:00.000Z",
  deleted_at: null,
}

test("mapper convierte fila de customer_retenciones al dominio", () => {
  const mapped = mapCustomerRetencionRowToCustomerRetencion(sampleRow)

  assert.equal(mapped.status, "pendiente")
  assert.equal(mapped.resultado, null)
  assert.equal(mapped.motivoBaja, "precio_situacion_economica")
})

test("insert crea retención pendiente sin campos de finalización", () => {
  const insert = mapCreateCustomerRetencionPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    assignedEmployeeId: "employee-1",
    assignedByEmployeeId: "employee-2",
    motivoBaja: "mudanza",
    detail: "Cliente se muda de zona",
  })

  assert.equal(insert.status, "pendiente")
  assert.equal(insert.resultado, null)
  assert.equal(insert.resolution, null)
  assert.equal(insert.completed_at, null)
})

test("update de finalización persiste resultado y resolución", () => {
  const update = mapUpdateCustomerRetencionCompletePayloadToUpdate({
    status: "finalizada",
    resultado: "retenido",
    resolution: "Acuerdo alcanzado con el cliente",
    completedAt: "2026-07-08T15:00:00.000Z",
    completedByEmployeeId: "employee-1",
  })

  assert.equal(update.status, "finalizada")
  assert.equal(update.resultado, "retenido")
  assert.equal(update.resolution, "Acuerdo alcanzado con el cliente")
})
