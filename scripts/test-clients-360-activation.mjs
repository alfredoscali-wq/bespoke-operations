import assert from "node:assert/strict"
import test from "node:test"

import {
  CUSTOMER_ALREADY_ACTIVE_MESSAGE,
  CUSTOMER_NOT_PENDING_ACTIVATION_MESSAGE,
  planClients360CustomerActivation,
} from "../lib/customers/customer-operational.ts"
import { buildClients360Directory } from "../lib/isp/clients-360-directory.ts"
import {
  appendReleasedActivationCustomers,
  filterPendingActivationCustomers,
  presentPendingActivationListItem,
  releasedInstallationCustomerIds,
  withoutPendingActivationEntries,
} from "../lib/isp/clients-360-activation.ts"

function customer(partial) {
  return {
    id: partial.id,
    name: partial.name,
    externalCode: partial.externalCode ?? null,
    locality: partial.locality ?? "La Banda",
    status: partial.status ?? "activo",
    inUniverse: partial.inUniverse ?? false,
    dni: partial.dni ?? null,
    phone: partial.phone ?? null,
    email: partial.email ?? null,
    customerNumber: partial.customerNumber ?? "CLI-000111",
    address: partial.address ?? "Calle 1",
    contractedPlan: partial.contractedPlan ?? "FTTH 50 Mb",
  }
}

test("el pendiente sin número se puede activar y el activo no", () => {
  const pending = planClients360CustomerActivation({
    status: "pendiente-activacion",
    externalCustomerCode: "",
  })
  assert.equal(pending.outcome, "activate")
  if (pending.outcome === "activate") {
    assert.equal(pending.previousStatus, "pendiente-activacion")
  }

  const active = planClients360CustomerActivation({
    status: "activo",
    externalCustomerCode: null,
  })
  assert.equal(active.outcome, "rejected")
  if (active.outcome === "rejected") {
    assert.equal(active.message, CUSTOMER_ALREADY_ACTIVE_MESSAGE)
  }

  const numbered = planClients360CustomerActivation({
    status: "pendiente-activacion",
    externalCustomerCode: "0000222",
  })
  assert.equal(numbered.outcome, "rejected")
  if (numbered.outcome === "rejected") {
    assert.equal(numbered.message, CUSTOMER_NOT_PENDING_ACTIVATION_MESSAGE)
  }
})

test("la instalación reutilizada no habilita el alta en el listado", () => {
  const ids = releasedInstallationCustomerIds([
    { customerId: "new", metadata: {} },
    { customerId: "reused", metadata: { reusedExistingCustomer: true } },
    { customerId: "", metadata: {} },
  ])
  assert.deepEqual([...ids], ["new"])
})

test("el pendiente sale del listado y el activado entra sin duplicar el padrón", () => {
  const pending = customer({
    id: "pending",
    name: "Pendiente Ana",
    status: "pendiente-activacion",
    externalCode: null,
    inUniverse: true,
  })
  const released = customer({
    id: "released",
    name: "Activo Luis",
    status: "activo",
    externalCode: null,
    customerNumber: "CLI-000222",
  })
  const kept = customer({
    id: "kept",
    name: "Ya en 360",
    status: "activo",
    externalCode: "222",
    inUniverse: true,
  })
  const built = buildClients360Directory({
    universeCustomers: [pending, kept],
    liveCustomers: [pending, kept],
    records: [
      {
        abnetConnectionId: "10",
        abnetCustomerNumber: "222",
        customerName: "Ya en 360",
        connectionStatus: "activa",
        gratis: "no",
        planName: "50MB+TV BASICO",
        serviceType: "Fibra",
        nodeName: "Nodo",
      },
    ],
  })
  const habitual = withoutPendingActivationEntries(built, new Set(["pending"]))
  assert.equal(habitual.some((entry) => entry.customerId === "pending"), false)
  assert.equal(habitual.some((entry) => entry.id === "abnet-222"), false)
  const placed = appendReleasedActivationCustomers(
    habitual,
    [pending, released, kept],
    new Set(["pending", "released", "kept"])
  )
  assert.equal(placed.addedIds.has("released"), true)
  assert.equal(placed.addedIds.has("pending"), false)
  assert.equal(placed.addedIds.has("kept"), false)
  assert.equal(placed.entries.filter((entry) => entry.customerId === "released").length, 1)
  assert.equal(placed.entries.some((entry) => entry.customerId === "pending"), false)
})

test("el panel de pendientes conserva los datos para revisar antes de activar", () => {
  const item = presentPendingActivationListItem({
    id: "pending",
    name: "Pendiente Ana",
    dni: "30111222",
    phone: "3855000000",
    address: "Calle 1",
    locality: "La Banda",
    status: "pendiente-activacion",
    bespokeCustomerNumber: "CLI-000111",
    externalCustomerCode: null,
    contractedPlan: "FTTH 50 Mb",
  })
  assert.equal(item.activationState, "pending")
  assert.equal(item.commercialPlanLabel, "FTTH 50 Mb")
  assert.equal(item.serviceCount, 0)
  assert.equal(item.connectionCount, 0)
  const found = filterPendingActivationCustomers([item], { search: "30111222" })
  assert.equal(found.length, 1)
  assert.equal(filterPendingActivationCustomers([item], { search: "no-esta" }).length, 0)
})
