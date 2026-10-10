import assert from "node:assert/strict"
import test from "node:test"

import { matchesAbnetPadronFilters } from "../lib/subscriptions/abnet-tv-padron.ts"

function row(number, extra = {}) {
  return {
    abnetCustomerNumber: number,
    customerName: extra.customerName ?? "Cliente",
    planName: extra.planName ?? "20 MB +TV BASICO",
    serviceType: extra.serviceType ?? "Wireless",
    node: extra.node ?? "Nodo BoozNet Norte",
    bespokeCustomerNumber: extra.bespokeCustomerNumber ?? null,
    bespokeCustomerName: extra.bespokeCustomerName ?? null,
    tvKind: extra.tvKind ?? "basica",
    jubilado: extra.jubilado ?? false,
    status: extra.status ?? "Activa",
    duplicateGroupSize: extra.duplicateGroupSize ?? 1,
  }
}

function filters(search, extra = {}) {
  return {
    tvKind: extra.tvKind ?? "all",
    jubilado: extra.jubilado ?? false,
    status: extra.status ?? "all",
    duplicatesOnly: extra.duplicatesOnly ?? false,
    search,
  }
}

function visible(rows, search, extra) {
  return rows.filter((item) => matchesAbnetPadronFilters(item, filters(search, extra)))
}

const padron = [
  row("1390", { customerName: "Miguel Matias Fauda", bespokeCustomerNumber: "CLI-005736" }),
  row("2313", {
    customerName: "Santos Maricel",
    bespokeCustomerNumber: "CLI-001390",
    bespokeCustomerName: "Santos Maricel",
  }),
  ...Array.from({ length: 5 }, (_, index) =>
    row("284", {
      customerName: "Paris Matias Alejandro",
      duplicateGroupSize: 5,
      tvKind: index === 0 ? "full" : "basica",
      status: index === 1 ? "Morosa" : "Activa",
    })
  ),
  ...Array.from({ length: 8 }, () =>
    row("2274", {
      customerName: "Fernandez de Maussion Sebastian",
      duplicateGroupSize: 8,
      bespokeCustomerNumber: "CLI-002274",
    })
  ),
  row("22740", { customerName: "Vecino", bespokeCustomerNumber: "CLI-022740" }),
]

test("1390 muestra solo ese N° Cliente y no el CLI-001390 de Santos", () => {
  const rows = visible(padron, "1390")
  assert.deepEqual(
    rows.map((item) => item.customerName),
    ["Miguel Matias Fauda"]
  )
  assert.equal(rows.some((item) => item.abnetCustomerNumber === "2313"), false)
  assert.equal(rows.some((item) => item.bespokeCustomerNumber === "CLI-001390"), false)
  assert.equal(rows.length, 1)
})

test("00001390 es el mismo N° que 1390", () => {
  const rows = visible(
    [
      row("00001390", { customerName: "Miguel Matias Fauda" }),
      row("2313", { customerName: "Santos Maricel", bespokeCustomerNumber: "CLI-001390" }),
    ],
    "1390"
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].abnetCustomerNumber, "00001390")
  assert.equal(visible(padron, "00001390").map((item) => item.abnetCustomerNumber).join(","), "1390")
})

test("284 devuelve sus 5 filas y el contador coincide", () => {
  const rows = visible(padron, "284")
  assert.equal(rows.length, 5)
  assert.equal(rows.every((item) => item.abnetCustomerNumber === "284"), true)
})

test("2274 devuelve sus 8 filas y no el número 22740", () => {
  const rows = visible(padron, "2274")
  assert.equal(rows.length, 8)
  assert.equal(rows.every((item) => item.abnetCustomerNumber === "2274"), true)
  assert.equal(rows.some((item) => item.abnetCustomerNumber === "22740"), false)
})

test("un N° inexistente deja la tabla vacía", () => {
  const rows = visible(padron, "999999")
  assert.deepEqual(rows, [])
  assert.equal(rows.length, 0)
})

test("el N° se cruza con TV, estado y condición", () => {
  const full = visible(padron, "284", { tvKind: "full" })
  const morosa = visible(padron, "284", { status: "Morosa" })
  const jubilado = visible(padron, "284", { jubilado: true })
  const duplicates = visible(padron, "284", { duplicatesOnly: true })
  assert.equal(full.length, 1)
  assert.equal(full[0].tvKind, "full")
  assert.equal(morosa.length, 1)
  assert.equal(morosa[0].status, "Morosa")
  assert.equal(jubilado.length, 0)
  assert.equal(duplicates.length, 5)
  assert.equal(full.every((item) => item.abnetCustomerNumber === "284"), true)
})

test("un texto sigue buscando en los campos del padrón", () => {
  const byName = visible(padron, "maricel")
  assert.equal(byName.length, 1)
  assert.equal(byName[0].abnetCustomerNumber, "2313")
  const byPlan = visible(
    [row("10", { planName: "Plan especial 1390" }), row("11", { planName: "Otro" })],
    "especial"
  )
  assert.equal(byPlan.length, 1)
  assert.equal(byPlan[0].abnetCustomerNumber, "10")
})
