/**
 * RC 3.2.3 — exclusive management helpers.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  findOperatorActiveManagement,
  isOperatorAlreadyManagingError,
  parseBlockingAtencionIdFromManagementError,
} from "../lib/customer-atenciones/consultation-exclusive-management.ts"

function row(overrides = {}) {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    customerId: "c1",
    customerName: "Abaca Ramiro",
    channel: "telefono",
    motivo: "otro",
    detail: "Detalle",
    status: "en_gestion",
    nextStep: "seguimiento_cliente",
    attendedByEmployeeId: "e1",
    attendedByEmployeeName: "Empleado",
    activeManagementEmployeeId: "op-1",
    activeManagementEmployeeName: "Operador",
    activeManagementStartedAt: "2026-07-18T20:00:00.000Z",
    linkedTaskId: null,
    linkedTaskCode: null,
    followUpActions: [],
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T20:00:00.000Z",
    ...overrides,
  }
}

test("findOperatorActiveManagement returns the en_gestion owned by the operator", () => {
  const active = findOperatorActiveManagement(
    [
      row({ id: "other", activeManagementEmployeeId: "op-2" }),
      row({ id: "mine" }),
    ],
    "op-1",
    new Date("2026-07-18T21:00:00.000Z")
  )

  assert.ok(active)
  assert.equal(active.atencionId, "mine")
  assert.equal(active.customerName, "Abaca Ramiro")
  assert.match(active.expedienteCode, /^AT-/)
  assert.ok(active.relativeAge.length > 0)
})

test("parse blocking atencion id from RPC message", () => {
  const id = "11111111-2222-3333-4444-555555555555"
  assert.equal(
    parseBlockingAtencionIdFromManagementError(
      `CONSULTATION_OPERATOR_ALREADY_MANAGING: Ya tenés otra consulta en gestión.|blocking_atencion_id=${id}`
    ),
    id
  )
  assert.equal(isOperatorAlreadyManagingError("CONSULTATION_OPERATOR_ALREADY_MANAGING"), true)
})
