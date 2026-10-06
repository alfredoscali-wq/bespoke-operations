import assert from "node:assert/strict"
import test from "node:test"

import {
  getClients360CommercialUniverse,
  isCustomerInClients360Universe,
  CLIENTS_360_UNIVERSE_CONTROL,
} from "../lib/isp/clients-360-universe.ts"

const control = CLIENTS_360_UNIVERSE_CONTROL
const universe = new Set(getClients360CommercialUniverse())

test("el universo comercial auditado tiene 4.740 customers", () => {
  assert.equal(universe.size, 4740)
  assert.equal(control.counts.universe, 4740)
  assert.equal(control.counts.maestro, 4707)
  assert.equal(control.counts.approvedAltas, 33)
  assert.equal(control.counts.maestro + control.counts.approvedAltas, 4740)
})

test("las 4 inclusiones están y las 5 exclusiones y las 3 revisiones no", () => {
  for (const row of control.inclusions) {
    assert.equal(isCustomerInClients360Universe(row.id), true, row.customerNumber)
  }
  for (const row of [...control.exclusions, ...control.review]) {
    assert.equal(isCustomerInClients360Universe(row.id), false, row.customerNumber)
  }
})

test("histórico, número fuera del maestro y reciente sin OT quedan fuera", () => {
  assert.equal(isCustomerInClients360Universe(control.historical.id), false)
  assert.equal(isCustomerInClients360Universe(control.outsideMaster.id), false)
  assert.equal(isCustomerInClients360Universe(control.recentWithoutOt.id), false)
})

test("el listado más lo que queda fuera cubre los 5.835 customers", () => {
  const outside =
    control.counts.historical +
    control.counts.outsideMaster +
    control.counts.recentWithoutOt +
    control.counts.excludedExceptions +
    control.counts.review
  assert.equal(outside, 1095)
  assert.equal(control.counts.universe + outside, control.counts.physicalCustomers)
  assert.equal(control.counts.physicalCustomers, 5835)
  assert.equal(control.counts.services, 3998)
  assert.equal(control.counts.connections, 3998)
  assert.equal(control.counts.tasks, 1427)
})
