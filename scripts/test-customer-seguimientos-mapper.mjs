import assert from "node:assert/strict"
import test from "node:test"

import {
  mapCreateCustomerSeguimientoPayloadToInsert,
  mapCustomerSeguimientoRowToCustomerSeguimiento,
  mapUpdateCustomerSeguimientoCompletePayloadToUpdate,
} from "../lib/supabase/customer-seguimientos.mapper.ts"

const sampleRow = {
  id: "seguimiento-1",
  company_id: "company-1",
  customer_id: "customer-1",
  source_atencion_id: "atencion-1",
  previous_seguimiento_id: null,
  assigned_employee_id: "employee-1",
  scheduled_date: "2026-07-10",
  scheduled_time: "09:30:00",
  observation: "Confirmar resolución del reclamo",
  status: "pendiente",
  completion_action: null,
  completed_at: null,
  completed_by_employee_id: null,
  created_at: "2026-07-08T12:00:00.000Z",
  updated_at: "2026-07-08T12:00:00.000Z",
  deleted_at: null,
}

test("mapper convierte fila de customer_seguimientos al dominio", () => {
  const mapped = mapCustomerSeguimientoRowToCustomerSeguimiento(sampleRow)

  assert.equal(mapped.id, "seguimiento-1")
  assert.equal(mapped.sourceAtencionId, "atencion-1")
  assert.equal(mapped.status, "pendiente")
  assert.equal(mapped.scheduledTime, "09:30:00")
})

test("insert crea seguimiento pendiente vinculado a atención origen", () => {
  const insert = mapCreateCustomerSeguimientoPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    assignedEmployeeId: "employee-1",
    sourceAtencionId: "atencion-1",
    scheduledDate: "2026-07-10",
    scheduledTime: "10:00",
    observation: "Llamar para confirmar",
  })

  assert.equal(insert.status, "pendiente")
  assert.equal(insert.source_atencion_id, "atencion-1")
  assert.equal(insert.scheduled_time, "10:00")
  assert.equal(insert.observation, "Llamar para confirmar")
})

test("update de completado persiste acción y empleado", () => {
  const update = mapUpdateCustomerSeguimientoCompletePayloadToUpdate({
    completionAction: "Cliente confirmó solución",
    completedAt: "2026-07-08T15:00:00.000Z",
    completedByEmployeeId: "employee-1",
    status: "completado",
  })

  assert.equal(update.status, "completado")
  assert.equal(update.completion_action, "Cliente confirmó solución")
  assert.equal(update.completed_by_employee_id, "employee-1")
})
