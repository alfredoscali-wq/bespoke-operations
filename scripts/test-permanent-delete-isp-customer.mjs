/**
 * Admin "Eliminar definitivamente" must clear the ISP graph before
 * deleting customers. Excluir must not wipe ISP portfolio; it explains
 * the isp_services_customer_id_fkey blocker instead.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_CUSTOMER_HARD_DELETE_DEPENDENCY_ORDER,
  PERMANENT_DELETE_ISP_CUSTOMER_STEPS,
  deleteIspDependentsForCustomer,
} from "../lib/admin/permanent-delete-isp-customer.ts"
import { CUSTOMER_HAS_ISP_SERVICES_EXCLUDE_MESSAGE } from "../lib/customers/customer-delete.ts"
import { ISP_CUSTOMER_DELETE_BLOCKED_BY_SERVICES_CONSTRAINT } from "../lib/isp/connection-delete.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const permanentDelete = read("lib/admin/permanent-delete.ts")
const ispHelper = read("lib/admin/permanent-delete-isp-customer.ts")
const customerQueries = read("lib/supabase/customers.queries.ts")
const customerDelete = read("lib/customers/customer-delete.ts")
const conexionesSql = read(
  "supabase/migrations/20261208000100_isp_conexiones_1_0_delete.sql"
)
const customersSql = read("supabase/migrations/20260732000100_create_customers.sql")
const servicesSql = read(
  "supabase/migrations/20261128000100_isp_1_0_clientes_360_conexiones.sql"
)
const catalogSql = read(
  "supabase/migrations/20261129000100_isp_1_1_catalogo_servicios.sql"
)
const importer = read("lib/isp/migration/tv-component.ts")
const subscriptions = read("components/subscriptions/subscriptions-module.tsx")
const customer360 = read("components/isp/isp-customer-detail-screen.tsx")

function createRecordingClient({
  serviceIds = ["svc-1"],
  connectionIds = ["conn-1"],
} = {}) {
  const calls = []

  function builder(table) {
    let op = "unknown"
    const chain = {
      select() {
        op = "select"
        calls.push({ table, op })
        return chain
      },
      update(payload) {
        op = "update"
        calls.push({ table, op, payload })
        return chain
      },
      delete() {
        op = "delete"
        calls.push({ table, op })
        return chain
      },
      eq() {
        return chain
      },
      in() {
        return chain
      },
      then(resolve, reject) {
        if (table === "isp_services" && op === "select") {
          return Promise.resolve({
            data: serviceIds.map((id) => ({ id })),
            error: null,
          }).then(resolve, reject)
        }
        if (table === "isp_connections" && op === "select") {
          return Promise.resolve({
            data: connectionIds.map((id) => ({ id })),
            error: null,
          }).then(resolve, reject)
        }
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      },
    }
    return chain
  }

  return {
    calls,
    from(table) {
      return builder(table)
    },
  }
}

test("Eliminar definitivamente limpia ISP antes de borrar customers", () => {
  const ispCall = permanentDelete.indexOf(
    "await deleteIspDependentsForCustomer(client, input.customerId)"
  )
  const customerDelete = permanentDelete.indexOf(
    "const { error: customerDeleteError }"
  )
  assert.notEqual(ispCall, -1)
  assert.notEqual(customerDelete, -1)
  assert.ok(ispCall < customerDelete)
})

test("el orden de borrado ISP no usa CASCADE desde customers", () => {
  assert.deepEqual([...PERMANENT_DELETE_ISP_CUSTOMER_STEPS], [
    "select_isp_services",
    "select_isp_connections",
    "delete_isp_connection_equipment",
    "delete_isp_connections",
    "delete_isp_billing_run_items",
    "delete_isp_billing_documents",
    "clear_isp_services_replaced_service_id",
    "delete_isp_services",
    "delete_isp_subscribers",
  ])
  assert.deepEqual([...ISP_CUSTOMER_HARD_DELETE_DEPENDENCY_ORDER], [
    "isp_connection_equipment",
    "isp_connections",
    "isp_services",
    "isp_subscribers",
    "customers",
  ])
  assert.doesNotMatch(servicesSql, /customer_id uuid NOT NULL REFERENCES public.customers \(id\) ON DELETE CASCADE/)
  assert.doesNotMatch(customersSql, /ON DELETE CASCADE/)
  assert.match(conexionesSql, /isp_services_customer_id_fkey/)
  assert.equal(
    ISP_CUSTOMER_DELETE_BLOCKED_BY_SERVICES_CONSTRAINT,
    "isp_services_customer_id_fkey"
  )
})

test("deleteIspDependentsForCustomer borra en el orden correcto", async () => {
  const client = createRecordingClient()
  await deleteIspDependentsForCustomer(client, "cust-1")
  assert.deepEqual(
    client.calls.map((call) => `${call.op}:${call.table}`),
    [
      "select:isp_services",
      "select:isp_connections",
      "delete:isp_connection_equipment",
      "delete:isp_connections",
      "delete:isp_billing_run_items",
      "delete:isp_billing_documents",
      "update:isp_services",
      "delete:isp_services",
      "delete:isp_subscribers",
    ]
  )
  const replacedUpdate = client.calls.find(
    (call) => call.table === "isp_services" && call.op === "update"
  )
  assert.deepEqual(replacedUpdate.payload, { replaced_service_id: null })
})

test("sin servicios ISP no intenta borrar conexiones ni servicios", async () => {
  const client = createRecordingClient({ serviceIds: [], connectionIds: [] })
  await deleteIspDependentsForCustomer(client, "cust-empty")
  assert.deepEqual(
    client.calls.map((call) => `${call.op}:${call.table}`),
    [
      "select:isp_services",
      "delete:isp_billing_run_items",
      "delete:isp_billing_documents",
      "delete:isp_subscribers",
    ]
  )
})

test("Excluir no borra la cartera ISP; pide Eliminar definitivamente", () => {
  assert.match(customerDelete, /CUSTOMER_HAS_ISP_SERVICES_EXCLUDE_MESSAGE/)
  assert.equal(
    CUSTOMER_HAS_ISP_SERVICES_EXCLUDE_MESSAGE.includes("Eliminar definitivamente"),
    true
  )
  assert.match(customerQueries, /HAS_ISP_SERVICES/)
  assert.match(customerQueries, /isp_services_customer_id_fkey/)
  assert.match(customerQueries, /customerHasIspPortfolio/)
  const deleteFn = customerQueries.slice(
    customerQueries.indexOf("export async function deleteCustomer")
  )
  assert.doesNotMatch(deleteFn, /deleteIspDependentsForCustomer/)
  assert.match(deleteFn, /HAS_ISP_SERVICES/)
})

test("no modifica importador, catálogo, Clientes 360 ni /subscriptions", () => {
  assert.doesNotMatch(importer, /deleteIspDependentsForCustomer/)
  assert.doesNotMatch(catalogSql, /deleteIspDependentsForCustomer/)
  assert.doesNotMatch(customer360, /deleteIspDependentsForCustomer/)
  assert.doesNotMatch(subscriptions, /deleteIspDependentsForCustomer/)
  assert.doesNotMatch(ispHelper, /isp_service_catalog/)
})
