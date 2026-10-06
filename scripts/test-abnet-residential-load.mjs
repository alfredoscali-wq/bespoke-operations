import assert from "node:assert/strict"
import test from "node:test"

import {
  abnetExactInternetKey,
  collapseExactInternetCopies,
  decideResidentialStatus,
  mapAbnetResidentialCatalog,
  planAbnetResidentialLoad,
  resolveUnambiguousIp,
} from "../lib/isp/abnet-residential-load.ts"

const row = (overrides = {}) => ({
  number: "4151",
  name: "Cliente",
  tipo: "Wireless",
  nodo: "Nodo Norte",
  plan: "20 MB +TV BASICO",
  estado: "Activa",
  tv: 4500,
  finalAmount: 3375,
  ...overrides,
})

test("solo los cuatro planes residenciales con el tipo correcto", () => {
  assert.equal(mapAbnetResidentialCatalog("Wireless", "20 MB +TV BASICO"), "WIRELESS-20-TV-BASICO")
  assert.equal(mapAbnetResidentialCatalog("Fibra", "50MB+TV BASICO"), "FTTH-50-TV-BASICO")
  assert.equal(mapAbnetResidentialCatalog("Fibra", "100MB+TV BASICO"), "FTTH-100-TV-BASICO")
  assert.equal(mapAbnetResidentialCatalog("Fibra", "300MB+TV BASICO "), "FTTH-300-TV-BASICO")
  assert.equal(mapAbnetResidentialCatalog("Fibra", "20 MB +TV BASICO"), null)
  assert.equal(mapAbnetResidentialCatalog("Wireless", "20 MB +TV BASICO JUBILADO"), null)
  assert.equal(mapAbnetResidentialCatalog("Wireless", "Servicio EMPRESA 50 MEGAS"), null)
  assert.equal(mapAbnetResidentialCatalog("TV Plan", "TV PACK FULL 2"), null)
})

test("la copia exacta exige tipo, nodo, plan, estado, TV y FINAL", () => {
  const copy = row()
  const collapsed = collapseExactInternetCopies([row(), copy, row({ estado: "Pendiente" })])
  assert.equal(collapsed.extraCopies, 1)
  assert.equal(collapsed.kept.length, 2)
  assert.notEqual(abnetExactInternetKey(row()), abnetExactInternetKey(row({ nodo: "Otro nodo" })))
  assert.notEqual(abnetExactInternetKey(row({ tipo: "Wireless" })), abnetExactInternetKey(row({ tipo: "Fibra", plan: "50MB+TV BASICO" })))
})

test("morosa e inactiva no se convierten en baja", () => {
  const activa = decideResidentialStatus("Activa")
  const pendiente = decideResidentialStatus("Pendiente")
  const morosa = decideResidentialStatus("Morosa")
  const inactiva = decideResidentialStatus("Inactiva")
  assert.equal(activa.load && activa.commercialStatus, "active")
  assert.equal(pendiente.load && pendiente.commercialStatus, "pending_activation")
  assert.equal(pendiente.load && pendiente.activationDate, null)
  assert.equal(morosa.load, false)
  assert.equal(inactiva.load, false)
  assert.equal(morosa.load ? "" : morosa.reason.includes("baja"), true)
})

test("la IP solo se copia si tipo y nodo coinciden en un único valor", () => {
  const billing = [
    { number: "1", tipo: "Wireless", nodo: "Nodo Norte", ip: "192.168.1.10" },
    { number: "1", tipo: "Fibra", nodo: "La Granja FO", ip: "10.0.0.2" },
    { number: "2", tipo: "Wireless", nodo: "Nodo Norte", ip: "192.168.1.10" },
    { number: "2", tipo: "Wireless", nodo: "Nodo Norte", ip: "192.168.1.11" },
  ]
  assert.equal(resolveUnambiguousIp([billing[0]], "Wireless", "Nodo Norte"), "192.168.1.10")
  assert.equal(resolveUnambiguousIp([billing[2], billing[3]], "Wireless", "Nodo Norte"), null)
  assert.equal(resolveUnambiguousIp(billing, "Wireless", "Otro"), null)
})

test("no carga sin customer único y conserva dos servicios distintos", () => {
  const rows = [
    row({ number: "10", estado: "Activa" }),
    row({ number: "10", tipo: "Fibra", plan: "300MB+TV BASICO", nodo: "La Granja FO", estado: "Pendiente", tv: null, finalAmount: null }),
    row({ number: "11", estado: "Morosa" }),
    row({ number: "12" }),
    row({ number: "13" }),
  ]
  const plan = planAbnetResidentialLoad({
    internetRows: rows,
    billingRows: [{ number: "10", tipo: "Wireless", nodo: "Nodo Norte", ip: "192.168.5.1" }],
    customersByNumber: new Map([
      ["10", ["customer-10"]],
      ["11", ["customer-11"]],
      ["13", ["customer-13a", "customer-13b"]],
    ]),
  })
  assert.equal(plan.loadRows.length, 2)
  assert.deepEqual(plan.loadRows.map((item) => item.catalogCode), [
    "WIRELESS-20-TV-BASICO",
    "FTTH-300-TV-BASICO",
  ])
  assert.equal(plan.loadRows[0].ip, "192.168.5.1")
  assert.equal(plan.loadRows[1].ip, null)
  assert.equal(plan.excludedStatus, 1)
  assert.equal(plan.excludedNoCustomer, 1)
  assert.equal(plan.excludedAmbiguousCustomer, 1)
  assert.equal(plan.multipleServiceCustomers, 1)
})
