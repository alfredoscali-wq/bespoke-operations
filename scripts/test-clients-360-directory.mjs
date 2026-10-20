import assert from "node:assert/strict"
import test from "node:test"

import {
  applyClients360DirectoryRemovals,
  buildClients360Directory,
  clients360PadronNumberFromId,
  filterClients360Directory,
  paginateClients360Directory,
  summarizeClients360Directory,
} from "@/lib/isp/clients-360-directory"

function customer(partial) {
  return {
    id: partial.id,
    name: partial.name,
    externalCode: partial.externalCode ?? null,
    locality: partial.locality ?? null,
    status: partial.status ?? "activo",
    inUniverse: partial.inUniverse ?? true,
    dni: partial.dni ?? null,
    phone: partial.phone ?? null,
    email: partial.email ?? null,
    bespokePackFutbol: partial.bespokePackFutbol === true,
    bespokeTvFull: partial.bespokeTvFull === true,
  }
}

function connection(partial) {
  return {
    abnetConnectionId: partial.id,
    abnetCustomerNumber: partial.number,
    customerName: partial.name ?? "Abonado",
    connectionStatus: partial.status ?? "activa",
    gratis: partial.gratis ?? "no",
    planName: partial.plan ?? "50MB+TV BASICO",
    serviceType: partial.serviceType ?? "Fibra",
    nodeName: partial.node ?? "Nodo",
  }
}

test("sin fichas, un abonado con varias conexiones es una sola persona", () => {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [
      connection({ id: "10", number: "222", name: "Herther Jose" }),
      connection({ id: "11", number: "222", name: "Herther Jose", plan: "TV PACK FULL 2" }),
      connection({ id: "12", number: "300", name: "Otra Persona", gratis: "si" }),
    ],
  })
  assert.equal(entries.length, 2)
  const herther = entries.find((entry) => entry.externalCode === "222")
  assert.equal(herther.origin, "padron")
  assert.equal(herther.link, "importado")
  assert.equal(herther.customerId, null)
  assert.deepEqual(herther.registryConnectionIds, ["10", "11"])
  assert.equal(summarizeClients360Directory(entries).subscribers, 2)
  assert.equal(summarizeClients360Directory(entries).connections, 3)
  assert.equal(summarizeClients360Directory(entries).bespokeSubscribers, 0)
})

test("coincidencia unica se vincula a la ficha y no duplica la persona", () => {
  const entries = buildClients360Directory({
    universeCustomers: [customer({ id: "uuid-1", name: "Herther Jose", externalCode: "00000222" })],
    liveCustomers: [customer({ id: "uuid-1", name: "Herther Jose", externalCode: "00000222" })],
    records: [
      connection({ id: "10", number: "222" }),
      connection({ id: "11", number: "222" }),
    ],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].id, "uuid-1")
  assert.equal(entries[0].origin, "bespoke")
  assert.equal(entries[0].link, "vinculado")
  assert.equal(entries[0].registryConnectionCount, 2)
})

test("coincidencia unica fuera del universo fijo tambien muestra la ficha", () => {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [customer({ id: "uuid-9", name: "Fuera de lista", externalCode: "50", inUniverse: false })],
    records: [connection({ id: "1", number: "50", name: "Fuera de lista" })],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].id, "uuid-9")
  assert.equal(entries[0].origin, "bespoke")
  assert.equal(entries[0].link, "vinculado")
})

test("varias fichas con el mismo numero quedan en revision y no agregan otra persona", () => {
  const entries = buildClients360Directory({
    universeCustomers: [
      customer({ id: "uuid-a", name: "Ana", externalCode: "1390" }),
      customer({ id: "uuid-b", name: "Bea", externalCode: "1390" }),
    ],
    liveCustomers: [
      customer({ id: "uuid-a", name: "Ana", externalCode: "1390" }),
      customer({ id: "uuid-b", name: "Bea", externalCode: "1390" }),
    ],
    records: [connection({ id: "7", number: "1390", name: "Ana" })],
  })
  assert.equal(entries.length, 2)
  assert.equal(entries.every((entry) => entry.link === "revision"), true)
  assert.equal(summarizeClients360Directory(entries).connections, 1)
})

test("varias fichas fuera del universo muestran un solo caso para revision", () => {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [
      customer({ id: "uuid-a", name: "Ana", externalCode: "1390", inUniverse: false }),
      customer({ id: "uuid-b", name: "Bea", externalCode: "1390", inUniverse: false }),
    ],
    records: [connection({ id: "7", number: "1390" })],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].origin, "padron")
  assert.equal(entries[0].link, "revision")
  assert.equal(entries[0].customerId, null)
  assert.equal(clients360PadronNumberFromId(entries[0].id), "1390")
})

test("una ficha historica ausente del padron se conserva y no es una baja", () => {
  const entries = buildClients360Directory({
    universeCustomers: [customer({ id: "uuid-old", name: "Historico", externalCode: "80" })],
    liveCustomers: [customer({ id: "uuid-old", name: "Historico", externalCode: "80" })],
    records: [connection({ id: "1", number: "81", name: "Otro" })],
  })
  const historical = entries.find((entry) => entry.id === "uuid-old")
  assert.equal(historical.link, "ausente")
  assert.equal(
    historical.note,
    "Sin conexión en el padrón actual — revisar posible baja"
  )
  assert.equal(historical.commercialPlanLabel, historical.note)
  assert.notEqual(historical.listStatus, "baja")
  assert.equal(entries.some((entry) => entry.externalCode === "81"), true)
})

test("la busqueda, el filtro de estado y la paginacion cuentan abonados", () => {
  const entries = buildClients360Directory({
    universeCustomers: [
      customer({ id: "uuid-1", name: "Activo Bespoke", externalCode: "1" }),
    ],
    liveCustomers: [customer({ id: "uuid-1", name: "Activo Bespoke", externalCode: "1" })],
    records: [
      connection({ id: "10", number: "1" }),
      connection({ id: "20", number: "2", name: "Solo padron" }),
    ],
  }).map((entry) =>
    entry.id === "uuid-1" ? { ...entry, listStatus: "activo", serviceCount: 1, technicalConnectionCount: 1 } : entry
  )
  const byConnection = filterClients360Directory(entries, { search: "20" })
  assert.equal(byConnection.length, 1)
  assert.equal(byConnection[0].externalCode, "2")
  const onlyActive = filterClients360Directory(entries, { status: "activo" })
  assert.deepEqual(onlyActive.map((entry) => entry.id), ["uuid-1"])
  const page = paginateClients360Directory(entries, 1, 1)
  assert.equal(page.total, 2)
  assert.equal(page.entries.length, 1)
})

test("99999999 no vincula una ficha con el numero de documento ausente", () => {
  const entries = buildClients360Directory({
    universeCustomers: [customer({ id: "uuid-x", name: "Sin documento", externalCode: "99999999" })],
    liveCustomers: [customer({ id: "uuid-x", name: "Sin documento", externalCode: "99999999" })],
    records: [connection({ id: "1", number: "99999999", name: "Marcador" })],
  })
  assert.equal(entries.find((entry) => entry.id === "uuid-x").link, "sin_numero")
  assert.equal(entries.some((entry) => entry.origin === "padron"), true)
})

test("un abonado con una conexión muestra el plan comercial", () => {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [connection({ id: "10", number: "20", plan: "50MB+TV BASICO", serviceType: "Fibra" })],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].commercialPlanLabel, "FTTH 50 Mb + TV Básica")
  assert.equal(entries[0].registryConnectionCount, 1)
  assert.deepEqual(entries[0].registryConnectionIds, ["10"])
  assert.equal(entries[0].serviceCount, 0)
  assert.equal(entries[0].technicalConnectionCount, 0)
})

test("dos conexiones del mismo plan se muestran una vez con la cantidad", () => {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [
      connection({ id: "10", number: "20", plan: "100MB+TV BASICO", serviceType: "Fibra" }),
      connection({ id: "11", number: "20", plan: "100MB+TV BASICO", serviceType: "Fibra" }),
    ],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].commercialPlanLabel, "FTTH 100 Mb + TV Básica · 2 conexiones")
  assert.deepEqual(entries[0].registryConnectionIds, ["10", "11"])
  assert.match(entries[0].note, /revisión comercial/)
})

test("dos planes distintos no se fusionan en un plan inventado", () => {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [
      connection({ id: "10", number: "20", plan: "50MB+TV BASICO", serviceType: "Fibra" }),
      connection({ id: "11", number: "20", plan: "20MB+TV BASICO", serviceType: "Wireless" }),
    ],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].commercialPlanLabel, "Varios planes comerciales")
  assert.deepEqual(entries[0].registryConnectionIds, ["10", "11"])
})

test("una conexión gratuita o morosa no se presenta como servicio pago ni como baja", () => {
  const gratis = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [
      connection({
        id: "10",
        number: "20",
        plan: "300MB+TV BASICO",
        serviceType: "Fibra",
        gratis: "si",
        status: "activa",
      }),
    ],
  })[0]
  assert.equal(gratis.commercialPlanLabel, "FTTH 300 Mb + TV Básica · Gratuita")
  assert.equal(gratis.registryGratisLabel, "Gratuita")
  assert.equal(gratis.registryStatusLabel, "Activa")
  assert.doesNotMatch(gratis.commercialPlanLabel, /Paga/)
  const morosa = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [
      connection({
        id: "11",
        number: "21",
        plan: "Wireless 20",
        serviceType: "",
        status: "morosa",
        gratis: "no",
      }),
    ],
  })[0]
  assert.equal(morosa.registryStatusLabel, "Morosa")
  assert.equal(morosa.link, "importado")
  assert.equal(morosa.commercialPlanLabel, "Wireless 20")
  assert.notEqual(morosa.listStatus, "baja")
})

test("un abonado sin datos técnicos de Bespoke conserva el plan comercial", () => {
  const entries = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [connection({ id: "8", number: "40", plan: "Plan no catalogado", serviceType: "" })],
  })
  const entry = entries[0]
  assert.equal(entry.serviceCount, 0)
  assert.equal(entry.technicalConnectionCount, 0)
  assert.equal(entry.commercialPlanLabel, "Plan no catalogado")
  assert.equal(entry.registryConnectionCount, 1)
})

test("Pack Fútbol o TV Full vigentes se suman al plan informado", () => {
  const pack = buildClients360Directory({
    universeCustomers: [
      customer({
        id: "uuid-1",
        name: "Con pack",
        externalCode: "20",
        bespokePackFutbol: true,
      }),
    ],
    liveCustomers: [
      customer({
        id: "uuid-1",
        name: "Con pack",
        externalCode: "20",
        bespokePackFutbol: true,
      }),
    ],
    records: [connection({ id: "10", number: "20", plan: "50MB+TV BASICO", serviceType: "Fibra" })],
  })
  assert.equal(pack[0].commercialPlanLabel, "FTTH 50 Mb + TV Básica + Pack Fútbol")
  const full = buildClients360Directory({
    universeCustomers: [
      customer({ id: "uuid-2", name: "Con full", externalCode: "21", bespokeTvFull: true }),
    ],
    liveCustomers: [
      customer({ id: "uuid-2", name: "Con full", externalCode: "21", bespokeTvFull: true }),
    ],
    records: [connection({ id: "11", number: "21", plan: "50MB+TV BASICO", serviceType: "Fibra" })],
  })
  assert.equal(full[0].commercialPlanLabel, "FTTH 50 Mb + TV Full")
})

test("quitar un registro de Clientes 360 no revive el padrón ni borra sus conexiones", () => {
  const built = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [connection({ id: "10", number: "222", name: "Aguirre Hector" })],
  })
  const hidden = applyClients360DirectoryRemovals(
    built,
    new Set(),
    new Set(["222"])
  )
  assert.equal(hidden.length, 0)
  assert.equal(built[0].registryConnectionIds.includes("10"), true)
})
