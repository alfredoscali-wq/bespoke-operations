import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  applyAbnetConnectionImport,
  automaticTvUpsellAllowed,
  canConfirmAbnetConnectionImport,
  classifyAbnetRegistryLink,
  connectionStoredWithoutSecrets,
  mergeGratisConnectionSubset,
  parseAbnetConnectionSheet,
  planAbnetConnectionImport,
  resolveTvPackage,
} from "@/lib/isp/abnet-connection-registry"

const header = [
  "N° Cliente",
  "Cliente",
  "Tipo",
  "Nodo",
  "IP",
  "Plan",
  "Estado",
  "Id",
  "Email",
  "Telefono",
  "Usuario",
  "Password",
  "Gratis",
  "Incobrable",
]

function row(values) {
  return header.map((column) => values[column] ?? "")
}

function record(partial) {
  return {
    abnetConnectionId: "1",
    abnetCustomerNumber: "222",
    abnetClientId: "",
    customerName: "Herther Jose",
    serviceType: "Fibra",
    nodeName: "Nodo",
    planName: "50MB+TV BASICO",
    connectionStatus: "activa",
    rawStatus: "Activa",
    gratis: "no",
    incobrable: "no",
    companyLabel: "",
    altaAt: null,
    bajaRegisteredAt: null,
    bajaEffectiveAt: null,
    bajaReason: "",
    suspensionFrom: null,
    suspensionUntil: null,
    suspensionReason: "",
    replacedConnectionId: "",
    ...partial,
  }
}

test("un abonado conserva varias conexiones", () => {
  const parsed = parseAbnetConnectionSheet([
    header,
    row({
      "N° Cliente": "222",
      Id: "10",
      Plan: "50MB+TV BASICO",
      Estado: "Activa",
      Gratis: "No",
      Password: "secreto-no-guardar",
      Usuario: "pppoe-user",
    }),
    row({ "N° Cliente": "222", Id: "11", Plan: "TV PACK FULL 2", Estado: "Activa", Gratis: "No" }),
  ])
  assert.equal(parsed.issues.length, 0)
  assert.deepEqual(
    parsed.records.map((item) => item.abnetConnectionId),
    ["10", "11"]
  )
  assert.equal(parsed.records.every(connectionStoredWithoutSecrets), true)
  assert.equal(JSON.stringify(parsed.records).includes("secreto-no-guardar"), false)
  assert.equal(JSON.stringify(parsed.records).includes("pppoe-user"), false)
})

test("conexión gratuita y activa no ofrece upsell", () => {
  const parsed = parseAbnetConnectionSheet([
    header,
    row({ "N° Cliente": "10", Id: "1", Plan: "20 MB +TV BASICO", Estado: "Activa", Gratis: "Sí" }),
  ])
  const item = parsed.records[0]
  assert.equal(item.connectionStatus, "activa")
  assert.equal(item.gratis, "si")
  assert.equal(
    automaticTvUpsellAllowed({
      connectionStatus: item.connectionStatus,
      gratis: item.gratis,
      tvPackage: "basica",
      severalConnections: false,
    }),
    false
  )
})

test("morosa y gratuita queda en revisión sin oferta", () => {
  const parsed = parseAbnetConnectionSheet([
    header,
    row({ "N° Cliente": "11", Id: "2", Plan: "50MB+TV BASICO", Estado: "Morosa", Gratis: "Sí" }),
  ])
  const item = parsed.records[0]
  assert.equal(item.connectionStatus, "morosa")
  assert.equal(item.gratis, "si")
  assert.equal(
    automaticTvUpsellAllowed({
      connectionStatus: "morosa",
      gratis: "si",
      tvPackage: "basica",
      severalConnections: false,
    }),
    false
  )
})

test("gratuidad vacía queda desconocida y no se asume paga", () => {
  const parsed = parseAbnetConnectionSheet([
    header,
    row({ "N° Cliente": "12", Id: "3", Plan: "50MB+TV BASICO", Estado: "Activa", Gratis: "" }),
  ])
  assert.equal(parsed.records[0].gratis, "desconocido")
  assert.equal(
    automaticTvUpsellAllowed({
      connectionStatus: "activa",
      gratis: "desconocido",
      tvPackage: "basica",
      severalConnections: false,
    }),
    false
  )
})

test("una ficha de Bespoke ausente del padrón no es una baja", () => {
  const link = classifyAbnetRegistryLink({
    externalCode: "00002222",
    sharedNumber: false,
    connectionCount: 0,
  })
  assert.equal(link.link, "ausente")
  assert.equal(link.note, "Sin conexión en el padrón actual — revisar posible baja")
})

test("un número ABNet compartido por dos fichas queda en revisión", () => {
  const link = classifyAbnetRegistryLink({
    externalCode: "1390",
    sharedNumber: true,
    connectionCount: 1,
  })
  assert.equal(link.link, "revision")
})

test("Pack Fútbol vigente de Bespoke no lo pisa una importación de TV Básica", () => {
  assert.equal(
    resolveTvPackage({
      bespokePackFutbol: true,
      bespokeFull: false,
      importedPlan: "50MB+TV BASICO",
    }),
    "basica_pack"
  )
})

test("reimportar el mismo archivo no duplica conexiones", () => {
  const parsed = parseAbnetConnectionSheet([
    header,
    row({ "N° Cliente": "15", Id: "9", Plan: "100MB+TV BASICO", Estado: "Activa", Gratis: "No" }),
  ])
  const first = applyAbnetConnectionImport([], planAbnetConnectionImport([], parsed))
  assert.ok(!("error" in first))
  const secondPlan = planAbnetConnectionImport(first.records, parsed)
  assert.equal(secondPlan.created, 0)
  assert.equal(secondPlan.unchanged, 1)
  const second = applyAbnetConnectionImport(first.records, secondPlan)
  assert.ok(!("error" in second))
  assert.equal(second.records.length, 1)
})

test("encabezados incorrectos no producen conexiones", () => {
  const parsed = parseAbnetConnectionSheet([["Nombre", "Plan"], ["Ana", "50 MB"]])
  assert.equal(parsed.records.length, 0)
  assert.match(parsed.issues[0].reason, /encabezados/i)
})

test("un usuario sin rol administrador no confirma la importación", () => {
  assert.equal(canConfirmAbnetConnectionImport(null), false)
  assert.equal(canConfirmAbnetConnectionImport({ systemRole: "operador", roleCode: "operador" }), false)
  assert.equal(canConfirmAbnetConnectionImport({ systemRole: "administrador", roleCode: null }), true)
  const route = readFileSync(
    new URL("../app/api/isp/abnet-connections/import/route.ts", import.meta.url),
    "utf8"
  )
  assert.match(route, /canConfirmAbnetConnectionImport/)
  assert.doesNotMatch(route, /latam|register-client|registerClient/)
})

test("una fila inválida no cambia el padrón ya cargado", () => {
  const existing = [record({ abnetConnectionId: "1" })]
  const parsed = parseAbnetConnectionSheet([
    header,
    row({ "N° Cliente": "", Id: "2", Estado: "Activa", Gratis: "No" }),
  ])
  const plan = planAbnetConnectionImport(existing, parsed)
  const applied = applyAbnetConnectionImport(existing, plan)
  assert.ok("error" in applied)
  assert.equal(existing.length, 1)
  assert.equal(existing[0].abnetConnectionId, "1")
})

test("el subconjunto gratis solo descarta el mismo Id", () => {
  const general = [record({ abnetConnectionId: "1", abnetCustomerNumber: "20" })]
  const subset = [
    record({ abnetConnectionId: "1", abnetCustomerNumber: "20", gratis: "si" }),
    record({ abnetConnectionId: "2", abnetCustomerNumber: "20", gratis: "si" }),
  ]
  const merged = mergeGratisConnectionSubset(general, subset)
  assert.deepEqual(merged.map((item) => item.abnetConnectionId), ["1", "2"])
  assert.equal(merged[0].gratis, "no")
})

test("una conexión que desaparece del archivo siguiente se conserva", () => {
  const existing = [record({ abnetConnectionId: "1" }), record({ abnetConnectionId: "2" })]
  const parsed = parseAbnetConnectionSheet([
    header,
    row({ "N° Cliente": "222", Id: "1", Plan: "50MB+TV BASICO", Estado: "Activa", Gratis: "No" }),
  ])
  const applied = applyAbnetConnectionImport(existing, planAbnetConnectionImport(existing, parsed))
  assert.ok(!("error" in applied))
  assert.deepEqual(applied.records.map((item) => item.abnetConnectionId).sort(), ["1", "2"])
})
