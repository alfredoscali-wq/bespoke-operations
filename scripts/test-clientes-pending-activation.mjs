/**
 * Pendientes de activación keeps the current status list and drops rows
 * that already have N° Cliente.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  countCustomerOperationalSummary,
  isPendingActivationListCustomer,
  matchesCustomerQuickFilter,
} from "../lib/customers/customer-operational.ts"
import {
  defaultCustomerFilters,
  filterCustomers,
} from "../lib/customers/customer-filters.ts"

function customer(overrides = {}) {
  return {
    id: "cust-1",
    customerNumber: "INT-1",
    name: "Juan Pérez",
    status: "pendiente-activacion",
    validationStatus: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const emptyPending = customer({ id: "empty" })
const numberedPending = customer({
  id: "numbered",
  externalCustomerCode: "00006738",
})
const activeWithoutNumber = customer({
  id: "active-empty",
  status: "activo",
  externalCustomerCode: "",
})

test("quita del pendiente solo a quien ya tiene N° Cliente", () => {
  assert.equal(isPendingActivationListCustomer(emptyPending), true)
  assert.equal(isPendingActivationListCustomer(numberedPending), false)
  assert.equal(isPendingActivationListCustomer(activeWithoutNumber), false)
  assert.equal(numberedPending.externalCustomerCode, "00006738")

  const roster = [emptyPending, numberedPending, activeWithoutNumber]
  const summary = countCustomerOperationalSummary(roster)
  assert.equal(summary["pendientes-activacion"], 1)
  assert.equal(summary.operativos, 3)

  const listed = filterCustomers(roster, {
    ...defaultCustomerFilters,
    quickFilter: "pendientes-activacion",
  })
  assert.deepEqual(
    listed.map((item) => item.id),
    ["empty"]
  )
  assert.equal(
    matchesCustomerQuickFilter(numberedPending, "pendientes-activacion"),
    false
  )
})
