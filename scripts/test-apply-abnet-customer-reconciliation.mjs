import assert from "node:assert/strict"
import test from "node:test"

import {
  APPROVED_CONTACT_UPDATES,
  assertApprovedContactList,
  decideApprovedUpdate,
} from "./apply-abnet-customer-reconciliation.mjs"

const phone = APPROVED_CONTACT_UPDATES.find((row) => row.abnetNumber === "6511")

function customer(overrides = {}) {
  return {
    id: phone.customerId,
    customer_number: phone.customerNumber,
    name: "Arevalo Melina",
    dni: "30111222",
    email: null,
    phone: null,
    address: null,
    external_customer_code: "00006511",
    deleted_at: null,
    ...overrides,
  }
}

function master(overrides = {}) {
  return {
    customerNumber: "6511",
    name: "Arevalo Melina",
    document: "30111222",
    email: null,
    phone: phone.value,
    address: null,
    ...overrides,
  }
}

test("la lista aprobada son exactamente 8 campos de contacto y ninguna localidad", () => {
  assertApprovedContactList()
  assert.equal(APPROVED_CONTACT_UPDATES.some((row) => row.field === "locality" || row.value === "Córdoba"), false)
})

test("aplica cuando el campo sigue vacío y la identidad coincide", () => {
  const decision = decideApprovedUpdate(phone, {
    customer: customer(),
    master: master(),
    customersWithSameNumber: 1,
  })
  assert.equal(decision.action, "APPLY")
})

test("omite el cambio si el campo dejó de estar vacío", () => {
  const decision = decideApprovedUpdate(phone, {
    customer: customer({ phone: "3572000000" }),
    master: master(),
    customersWithSameNumber: 1,
  })
  assert.equal(decision.action, "SKIPPED_STALE_PREVIEW")
})

test("omite el cambio si el nombre o el DNI ya no coinciden", () => {
  const name = decideApprovedUpdate(phone, {
    customer: customer({ name: "Otra Persona" }),
    master: master(),
    customersWithSameNumber: 1,
  })
  const document = decideApprovedUpdate(phone, {
    customer: customer({ dni: "99999998" }),
    master: master({ document: "30111222" }),
    customersWithSameNumber: 1,
  })
  assert.equal(name.action, "SKIPPED_STALE_PREVIEW")
  assert.equal(document.action, "SKIPPED_STALE_PREVIEW")
})

test("omite el cambio si el maestro o el número dejaron de ser unívocos", () => {
  const source = decideApprovedUpdate(phone, {
    customer: customer(),
    master: master({ phone: "+5490000000000" }),
    customersWithSameNumber: 1,
  })
  const duplicate = decideApprovedUpdate(phone, {
    customer: customer(),
    master: master(),
    customersWithSameNumber: 2,
  })
  assert.equal(source.action, "SKIPPED_STALE_PREVIEW")
  assert.equal(duplicate.action, "SKIPPED_STALE_PREVIEW")
})
