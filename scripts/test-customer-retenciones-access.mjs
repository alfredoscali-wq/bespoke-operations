import assert from "node:assert/strict"
import test from "node:test"

import {
  canMarkCustomerRetencionReadyForRetiro,
  canViewAssignedCustomerRetenciones,
} from "../lib/customer-retenciones/access.ts"

test("administrador y administracion ven gestiones de baja asignadas", () => {
  assert.equal(canViewAssignedCustomerRetenciones("administrador"), true)
  assert.equal(canViewAssignedCustomerRetenciones("administracion"), true)
})

test("administrador y administracion pueden marcar listo para retiro", () => {
  assert.equal(canMarkCustomerRetencionReadyForRetiro("administrador"), true)
  assert.equal(canMarkCustomerRetencionReadyForRetiro("administracion"), true)
})

test("atencion_cliente no accede a supervisión ni marca listo para retiro", () => {
  assert.equal(canViewAssignedCustomerRetenciones("atencion_cliente"), false)
  assert.equal(canMarkCustomerRetencionReadyForRetiro("atencion_cliente"), false)
  assert.equal(canViewAssignedCustomerRetenciones(null), false)
})
