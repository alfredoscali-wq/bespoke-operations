import assert from "node:assert/strict"
import test from "node:test"

import {
  APPROVED_AUDIT_ROWS,
  APPROVED_MINOR_NAME_NUMBERS,
  EXCLUDED_ABNET_NUMBERS,
  EXCLUDED_CUSTOMER_IDS,
  PREEXISTING_DUPLICATE_ABNET_NUMBERS,
  assertApprovedIdentityList,
  decideApprovedIdentityAssignment,
} from "./apply-abnet-confirmed-identity.mjs"

const row = APPROVED_AUDIT_ROWS.find((item) => item.abnetNumber === "6795")

function customer(overrides = {}) {
  return {
    id: row.customerId,
    customer_number: row.customerNumber,
    external_customer_code: null,
    deleted_at: null,
    ...overrides,
  }
}

test("la lista aprobada son 164 filas, 163 customers y no incluye exclusiones", () => {
  const unique = assertApprovedIdentityList()
  assert.equal(APPROVED_AUDIT_ROWS.length, 164)
  assert.equal(unique.length, 163)
  const gomez = unique.filter((item) => item.abnetNumber === "6742")
  assert.deepEqual(gomez.map((item) => item.customerNumber), ["CLI-005665"])
  assert.equal(APPROVED_AUDIT_ROWS.filter((item) => item.abnetNumber === "6742").length, 2)
  for (const number of APPROVED_MINOR_NAME_NUMBERS) {
    assert.equal(unique.some((item) => item.abnetNumber === number), true)
  }
  for (const number of [...EXCLUDED_ABNET_NUMBERS, ...PREEXISTING_DUPLICATE_ABNET_NUMBERS]) {
    assert.equal(unique.some((item) => item.abnetNumber === number), false)
  }
  const ids = new Set(unique.map((item) => item.customerId))
  for (const id of EXCLUDED_CUSTOMER_IDS) assert.equal(ids.has(id), false)
})

test("asigna cuando el campo sigue vacío y el número no está tomado", () => {
  const decision = decideApprovedIdentityAssignment(row, {
    customer: customer(),
    customersWithSameNumber: 0,
  })
  assert.equal(decision.action, "UPDATED")
})

test("no vuelve a escribir si el customer ya tiene el número aprobado", () => {
  const decision = decideApprovedIdentityAssignment(row, {
    customer: customer({ external_customer_code: "00006795" }),
    customersWithSameNumber: 1,
  })
  assert.equal(decision.action, "SKIPPED_ALREADY_ASSIGNED")
})

test("no sobrescribe otro número ni usa un número ya tomado", () => {
  const otherNumber = decideApprovedIdentityAssignment(row, {
    customer: customer({ external_customer_code: "00005181" }),
    customersWithSameNumber: 0,
  })
  const taken = decideApprovedIdentityAssignment(row, {
    customer: customer(),
    customersWithSameNumber: 1,
  })
  assert.equal(otherNumber.action, "SKIPPED_REVALIDATION")
  assert.equal(taken.action, "SKIPPED_REVALIDATION")
})

test("rechaza un customer excluido, otro id y una asignación fuera de la lista", () => {
  const excluded = decideApprovedIdentityAssignment(row, {
    customer: customer(),
    customersWithSameNumber: 0,
    excludedCustomerIds: [row.customerId],
  })
  const other = decideApprovedIdentityAssignment(row, {
    customer: customer({ id: "00000000-0000-4000-8000-000000000099" }),
    customersWithSameNumber: 0,
  })
  const fake = {
    customerId: "11111111-1111-4111-8111-111111111111",
    customerNumber: "CLI-000001",
    abnetNumber: "6797",
  }
  const unapproved = decideApprovedIdentityAssignment(fake, {
    customer: {
      id: fake.customerId,
      customer_number: fake.customerNumber,
      external_customer_code: null,
      deleted_at: null,
    },
    customersWithSameNumber: 0,
    excludedCustomerIds: [],
  })
  assert.equal(excluded.action, "SKIPPED_REVALIDATION")
  assert.equal(other.action, "SKIPPED_REVALIDATION")
  assert.equal(unapproved.action, "SKIPPED_REVALIDATION")
})

test("la segunda fila de 6742 corresponde al mismo customer y no pide otra escritura", () => {
  const rows = APPROVED_AUDIT_ROWS.filter((item) => item.abnetNumber === "6742")
  assert.equal(rows[0].customerId, rows[1].customerId)
  const person = {
    id: rows[0].customerId,
    customer_number: "CLI-005665",
    external_customer_code: null,
    deleted_at: null,
  }
  const first = decideApprovedIdentityAssignment(rows[0], {
    customer: person,
    customersWithSameNumber: 0,
  })
  person.external_customer_code = "00006742"
  const second = decideApprovedIdentityAssignment(rows[1], {
    customer: person,
    customersWithSameNumber: 1,
  })
  assert.equal(first.action, "UPDATED")
  assert.equal(second.action, "SKIPPED_ALREADY_ASSIGNED")
})
