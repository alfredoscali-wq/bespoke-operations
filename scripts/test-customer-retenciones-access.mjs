import assert from "node:assert/strict"
import test from "node:test"

import {
  canAssignCustomerRetencion,
  canViewAssignedCustomerRetenciones,
} from "../lib/customer-retenciones/access.ts"

test("administrador y administracion pueden asignar retenciones", () => {
  assert.equal(canAssignCustomerRetencion("administrador"), true)
  assert.equal(canAssignCustomerRetencion("administracion"), true)
})

test("atencion_cliente y otros roles no pueden asignar retenciones", () => {
  assert.equal(canAssignCustomerRetencion("atencion_cliente"), false)
  assert.equal(canAssignCustomerRetencion("ventas"), false)
  assert.equal(canAssignCustomerRetencion(null), false)
})

test("administrador y administracion ven retenciones asignadas", () => {
  assert.equal(canViewAssignedCustomerRetenciones("administrador"), true)
  assert.equal(canViewAssignedCustomerRetenciones("administracion"), true)
})

test("atencion_cliente no ve retenciones asignadas de supervisión", () => {
  assert.equal(canViewAssignedCustomerRetenciones("atencion_cliente"), false)
  assert.equal(canViewAssignedCustomerRetenciones(null), false)
})
