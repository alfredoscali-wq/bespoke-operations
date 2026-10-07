/**
 * Clientes (no Clientes 360): Pendientes de activación = sin N° ABNet.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  countCustomerOperationalSummary,
  hasAssignedAbnetCustomerNumber,
  isCustomerPendingAbnetActivation,
  matchesCustomerQuickFilter,
} from "../lib/customers/customer-operational.ts"
import {
  defaultCustomerFilters,
  filterCustomers,
} from "../lib/customers/customer-filters.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function customer(overrides = {}) {
  return {
    id: "cust-1",
    customerNumber: "INT-1",
    name: "Juan Pérez",
    status: "activo",
    validationStatus: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const withNumber = customer({
  id: "with-number",
  externalCustomerCode: "00006738",
  status: "pendiente-activacion",
})
const withoutNumber = customer({
  id: "without-number",
  status: "pendiente-activacion",
})
const nullNumber = customer({
  id: "null-number",
  externalCustomerCode: null,
  status: "activo",
})
const emptyNumber = customer({
  id: "empty-number",
  externalCustomerCode: "",
  status: "activo",
})
const blankNumber = customer({
  id: "blank-number",
  externalCustomerCode: "   ",
  status: "pendiente-activacion",
})
const otWithoutNumber = customer({
  id: "ot-without",
  name: "Alta desde OT",
  status: "pendiente-activacion",
  externalCustomerCode: undefined,
})
const otWithNumber = customer({
  id: "ot-with",
  name: "Alta desde OT",
  status: "pendiente-activacion",
  externalCustomerCode: "00001234",
})
const deletedWithoutNumber = customer({
  id: "deleted",
  status: "pendiente-activacion",
  deletedAt: "2026-02-01T00:00:00.000Z",
})
const activeWithNumber = customer({
  id: "active-number",
  externalCustomerCode: "5814",
  status: "activo",
})

const roster = [
  withNumber,
  withoutNumber,
  nullNumber,
  emptyNumber,
  blankNumber,
  otWithoutNumber,
  otWithNumber,
  deletedWithoutNumber,
  activeWithNumber,
]

test("sin N° ABNet es pendiente y un número con ceros no lo es", () => {
  assert.equal(isCustomerPendingAbnetActivation(withoutNumber), true)
  assert.equal(isCustomerPendingAbnetActivation(nullNumber), true)
  assert.equal(isCustomerPendingAbnetActivation(emptyNumber), true)
  assert.equal(isCustomerPendingAbnetActivation(blankNumber), true)
  assert.equal(hasAssignedAbnetCustomerNumber("00006738"), true)
  assert.equal(isCustomerPendingAbnetActivation(withNumber), false)
  assert.equal(withNumber.externalCustomerCode, "00006738")
  assert.equal(isCustomerPendingAbnetActivation(activeWithNumber), false)
})

test("el estado pendiente-activacion no cuenta si ya hay N° ABNet", () => {
  assert.equal(withNumber.status, "pendiente-activacion")
  assert.equal(isCustomerPendingAbnetActivation(withNumber), false)
  assert.equal(matchesCustomerQuickFilter(withNumber, "pendientes-activacion"), false)
  assert.equal(isCustomerPendingAbnetActivation(otWithoutNumber), true)
  assert.equal(isCustomerPendingAbnetActivation(otWithNumber), false)
})

test("el KPI y el filtro usan la misma ausencia de N° ABNet", () => {
  const summary = countCustomerOperationalSummary(roster)
  const pending = roster.filter(
    (item) =>
      !item.deletedAt && matchesCustomerQuickFilter(item, "pendientes-activacion")
  )
  assert.equal(summary["pendientes-activacion"], pending.length)
  assert.equal(summary["pendientes-activacion"], 5)
  assert.equal(
    pending.some((item) => hasAssignedAbnetCustomerNumber(item.externalCustomerCode)),
    false
  )
  assert.equal(summary.operativos, roster.filter((item) => !item.deletedAt).length)
  assert.equal(
    summary.activos,
    roster.filter(
      (item) =>
        !item.deletedAt &&
        item.validationStatus === "active" &&
        item.status !== "pendiente-activacion"
    ).length
  )

  const listed = filterCustomers(roster, {
    ...defaultCustomerFilters,
    quickFilter: "pendientes-activacion",
  })
  assert.deepEqual(
    listed.map((item) => item.id).sort(),
    pending.map((item) => item.id).sort()
  )
  const byStatus = filterCustomers(roster, {
    ...defaultCustomerFilters,
    statusFilter: "pendiente-activacion",
  })
  assert.deepEqual(
    byStatus.map((item) => item.id).sort(),
    pending.map((item) => item.id).sort()
  )
  assert.equal(
    byStatus.some((item) => item.externalCustomerCode?.trim()),
    false
  )
})

test("la query de Clientes filtra por external_customer_code y no reescribe estados", () => {
  const queries = read("lib/supabase/customers.queries.ts")
  const summary = queries.slice(
    queries.indexOf("export async function getCustomerOperationalSummaryCounts"),
    queries.indexOf("export async function getCustomerById")
  )
  const quick = queries.slice(
    queries.indexOf("function applyCustomerQuickFilter"),
    queries.indexOf("function applyCustomerSearchFilter")
  )
  const status = queries.slice(
    queries.indexOf("function applyCustomerStatusFilter"),
    queries.indexOf("function applyCustomerSort")
  )
  assert.match(queries, /external_customer_code\.is\.null,external_customer_code\.eq\./)
  assert.match(summary, /applyMissingAbnetCustomerNumberFilter\(base\(\)\)/)
  assert.doesNotMatch(summary, /\.eq\("status", CUSTOMER_STATUS_PENDING_ACTIVATION\)/)
  assert.match(quick, /applyMissingAbnetCustomerNumberFilter/)
  assert.match(quick, /neq\("status", CUSTOMER_STATUS_PENDING_ACTIVATION\)/)
  assert.match(status, /statusFilter === "pendiente-activacion"/)
  assert.match(status, /applyMissingAbnetCustomerNumberFilter/)
  assert.doesNotMatch(`${summary}\n${quick}\n${status}`, /\.update\(|\.delete\(/)
  assert.doesNotMatch(read("lib/isp/clients-360-universe.ts"), /isCustomerPendingAbnetActivation/)
  assert.doesNotMatch(
    read("lib/customers/customer-operational.ts"),
    /getClients360CommercialUniverse/
  )
})
