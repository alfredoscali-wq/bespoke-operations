import assert from "node:assert/strict"
import test from "node:test"

import {
  completeAbnetPersonalProfile,
  parseAbnetCustomerSheet,
  planAbnetCustomerImport,
} from "@/lib/isp/abnet-customer-registry"
import {
  applyAbnetPersonalDirectory,
  buildClients360Directory,
} from "@/lib/isp/clients-360-directory"

const header = [
  "N° Cliente",
  "Nombre",
  "Revisar Doc",
  "DNI/CUIT",
  "Teléfono",
  "Domicilio",
  "Ciudad",
  "Idclientes",
]

function row(values) {
  return header.map((name) => values[name] ?? "")
}

function connection(partial) {
  return {
    abnetConnectionId: partial.id,
    abnetCustomerNumber: partial.number,
    customerName: partial.name ?? "Abonado",
    connectionStatus: "activa",
    gratis: "no",
    planName: "50MB+TV BASICO",
    serviceType: "Fibra",
    nodeName: "Nodo",
  }
}

test("coincidencia exacta completa el DNI una sola vez aunque haya dos conexiones", () => {
  const parsed = parseAbnetCustomerSheet([
    header,
    row({
      "N° Cliente": "00000222",
      Nombre: "Herther Jose",
      "DNI/CUIT": "30111222",
      Teléfono: "381555",
      Domicilio: "Calle 1",
      Ciudad: "Concepcion",
      Idclientes: "999",
    }),
  ])
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0].customerNumber, "222")
  assert.equal(parsed.records[0].document, "30111222")
  assert.notEqual(parsed.records[0].abnetClientId, "30111222")
  const entries = applyAbnetPersonalDirectory(
    buildClients360Directory({
      universeCustomers: [],
      liveCustomers: [],
      records: [
        connection({ id: "10", number: "222", name: "Herther Jose" }),
        connection({ id: "11", number: "222", name: "Herther Jose" }),
      ],
    }),
    parsed.records
  )
  assert.equal(entries.length, 1)
  assert.equal(entries[0].dni, "30111222")
  assert.equal(entries[0].phone, "381555")
  assert.equal(entries[0].address, "Calle 1")
  assert.equal(entries[0].registryConnectionCount, 2)
})

test("un DNI confiable se puede completar y un marcador no se inventa", () => {
  const parsed = parseAbnetCustomerSheet([
    header,
    row({ "N° Cliente": "20", "DNI/CUIT": "27888999" }),
    row({ "N° Cliente": "21", "DNI/CUIT": "99999999" }),
  ])
  const ready = parsed.records.find((record) => record.customerNumber === "20")
  const placeholder = parsed.records.find((record) => record.customerNumber === "21")
  assert.equal(ready.document, "27888999")
  assert.equal(ready.documentReview, false)
  assert.equal(placeholder.document, null)
})

test("un número inexistente en clientes.xlsx deja los datos vacíos", () => {
  const parsed = parseAbnetCustomerSheet([
    header,
    row({ "N° Cliente": "20", Nombre: "Ana", "DNI/CUIT": "27888999" }),
  ])
  const entries = applyAbnetPersonalDirectory(
    buildClients360Directory({
      universeCustomers: [],
      liveCustomers: [],
      records: [connection({ id: "1", number: "80", name: "Sin ficha personal" })],
    }),
    parsed.records
  )
  assert.equal(entries[0].dni, null)
  assert.equal(entries[0].phone, null)
  assert.equal(entries[0].address, null)
})

test("un número repetido no elige una fila y queda en revisión", () => {
  const parsed = parseAbnetCustomerSheet([
    header,
    row({ "N° Cliente": "20", Nombre: "Ana", "DNI/CUIT": "27888999" }),
    row({ "N° Cliente": "00000020", Nombre: "Ana", "DNI/CUIT": "27888999" }),
  ])
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0].reviewRequired, true)
  assert.equal(parsed.records[0].document, null)
  assert.match(parsed.records[0].reviewReason, /repetido/)
  const entries = applyAbnetPersonalDirectory(
    buildClients360Directory({
      universeCustomers: [],
      liveCustomers: [],
      records: [connection({ id: "1", number: "20" })],
    }),
    parsed.records
  )
  assert.equal(entries.length, 1)
  assert.equal(entries[0].dni, null)
  assert.match(entries[0].note, /revisión|repetido/)
})

test("datos contradictorios no eligen un DNI", () => {
  const parsed = parseAbnetCustomerSheet([
    header,
    row({ "N° Cliente": "20", Nombre: "Ana", "DNI/CUIT": "27888999" }),
    row({ "N° Cliente": "20", Nombre: "Ana", "DNI/CUIT": "30111000" }),
  ])
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0].reviewRequired, true)
  assert.equal(parsed.records[0].document, null)
  assert.match(parsed.records[0].reviewReason, /contradicen/)
})

test("un DNI de Bespoke distinto no se pisa y un campo vacío sí se completa", () => {
  const record = parseAbnetCustomerSheet([
    header,
    row({
      "N° Cliente": "20",
      Nombre: "Ana",
      "DNI/CUIT": "27888999",
      Teléfono: "381555",
    }),
  ]).records[0]
  const kept = completeAbnetPersonalProfile(
    {
      name: "Ana Bespoke",
      externalCode: "00000020",
      dni: "20111000",
      phone: null,
      email: null,
      address: null,
      locality: null,
      note: "",
    },
    record
  )
  assert.equal(kept.dni, "20111000")
  assert.equal(kept.phone, "381555")
  assert.match(kept.note, /DNI\/CUIT de Bespoke se conserva/)
})

test("la reimportación actualiza el mismo número sin duplicarlo", () => {
  const parsed = parseAbnetCustomerSheet([
    header,
    row({ "N° Cliente": "20", Nombre: "Ana", "DNI/CUIT": "27888999" }),
  ])
  const plan = planAbnetCustomerImport(
    [{ customerNumber: "20", name: "Ana", document: "27888999", reviewRequired: false }],
    parsed
  )
  assert.equal(plan.created, 0)
  assert.equal(plan.updated, 1)
  assert.equal(plan.records.length, 1)
})

test("un documento marcado para revisión no se completa", () => {
  const parsed = parseAbnetCustomerSheet([
    header,
    row({ "N° Cliente": "20", "Revisar Doc": "Sí", "DNI/CUIT": "27888999", Nombre: "Ana" }),
  ])
  assert.equal(parsed.records[0].document, null)
  assert.equal(parsed.records[0].documentReview, true)
  assert.equal(parsed.records[0].reviewRequired, false)
  const shown = completeAbnetPersonalProfile(
    {
      name: "Abonado 20",
      externalCode: "20",
      dni: null,
      phone: null,
      email: null,
      address: null,
      locality: null,
      note: "",
    },
    parsed.records[0]
  )
  assert.equal(shown.dni, null)
  assert.equal(shown.name, "Ana")
  assert.match(shown.note, /no se completa/)
})
