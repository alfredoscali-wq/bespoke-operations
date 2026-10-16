/**
 * Auditoría de solo lectura de las excepciones que quedaron fuera de la
 * primera carga residencial ABNet (commit 404071d).
 *
 * No hace INSERT, UPDATE ni DELETE. No escribe Excel. No asigna N° ABNet.
 *
 * Uso: npx tsx scripts/abnet-exceptions-audit.mjs
 */
import { createRequire } from "node:module"
import { createClient } from "@supabase/supabase-js"

import { documentDigits } from "../lib/isp/abnet-master-universe.ts"
import {
  abnetExactInternetKey,
  collapseExactInternetCopies,
  customerIdForAbnetNumber,
  fold,
  isInternetAccessType,
  mapAbnetResidentialCatalog,
} from "../lib/isp/abnet-residential-load.ts"
import { readAbnetMasterRows } from "./abnet-master-workbook.mjs"
import {
  ABNET_COMPANY_ID,
  DEFAULT_BILLING,
  DEFAULT_CONEX,
  fetchAll,
  loadEnv,
} from "./abnet-residential-sources.mjs"

const MASTER_PATH = "C:\\Users\\alfre\\Downloads\\BASE CLIENTES.xlsx"
const CASE_C = ["1016", "1785", "3509", "983", "158"]
const OUTSIDE_MASTER = ["6291", "6220", "5522", "4745", "4658", "5553", "4351", "865", "838", "2358", "2649", "4036"]
const CATALOG_PRICE = {
  "WIRELESS-20-TV-BASICO": 32800,
  "FTTH-50-TV-BASICO": 35300,
  "FTTH-100-TV-BASICO": 39300,
  "FTTH-300-TV-BASICO": 44300,
}
const PLACEHOLDER_DOCUMENTS = new Set([
  "0", "0000000", "00000000", "1111111", "11111111", "1234567", "12345678", "4444444", "9999999", "99999999",
])

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

function assertReadOnlyInvocation() {
  const blocked = ["--apply", "--write", "--execute"]
  if (process.argv.some((arg) => blocked.includes(arg))) {
    throw new Error("Esta auditoría no acepta escritura.")
  }
}

function readOnlyFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(`Auditoría de solo lectura: ${String(prop)} bloqueado en ${table}.`)
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
}

function normalizeHeader(value) {
  return fold(value).replace(/[^a-z0-9]/g, "")
}

function readMatrix(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos") ? "Datos" : workbook.SheetNames[0]
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true })
}

function headerMap(row) {
  const map = new Map()
  for (let index = 0; index < row.length; index += 1) {
    if (row[index] != null) map.set(normalizeHeader(row[index]), index)
  }
  return (aliases) => {
    for (const alias of aliases) {
      if (map.has(alias)) return map.get(alias)
    }
    return -1
  }
}

function text(value) {
  if (value == null) return null
  const current = String(value).trim()
  return current.length > 0 ? current : null
}

function amount(value) {
  if (value == null || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function numberFromCell(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value))
  const current = text(value)
  if (!current || !/^\d+$/.test(current)) return null
  const normalized = String(Number(current))
  return normalized === "0" ? null : normalized
}

function compactPlan(value) {
  return fold(value).replace(/[^a-z0-9+]/g, "")
}

function readInternetDetailed(file) {
  const matrix = readMatrix(file)
  const headerRow = matrix.findIndex((row) =>
    Array.isArray(row) && row.some((cell) => normalizeHeader(cell) === "ncliente" || normalizeHeader(cell) === "cliente")
  )
  if (headerRow < 0) throw new Error("Internet + TV no tiene encabezado reconocible.")
  const column = headerMap(matrix[headerRow])
  const numberIndex = column(["ncliente", "numerocliente"])
  const nameIndex = column(["cliente", "nombre"])
  const typeIndex = column(["tipo"])
  const nodeIndex = column(["nodo"])
  const planIndex = column(["plan"])
  const statusIndex = column(["estado"])
  const tvIndex = column(["tv"])
  const finalIndex = column(["final"])
  if ([numberIndex, nameIndex, typeIndex, planIndex, statusIndex].some((index) => index < 0)) {
    throw new Error("Internet + TV no tiene las columnas esperadas.")
  }
  return matrix.slice(headerRow + 1).flatMap((row) => {
    const number = numberFromCell(row[numberIndex])
    if (!number) return []
    return [{
      number,
      name: text(row[nameIndex]) ?? "",
      tipo: text(row[typeIndex]) ?? "",
      nodo: nodeIndex >= 0 ? text(row[nodeIndex]) : null,
      plan: text(row[planIndex]) ?? "",
      estado: text(row[statusIndex]) ?? "",
      tv: tvIndex >= 0 ? amount(row[tvIndex]) : null,
      finalAmount: finalIndex >= 0 ? amount(row[finalIndex]) : null,
    }]
  })
}

function readBillingDetailed(file) {
  const matrix = readMatrix(file)
  const column = headerMap(matrix[0] ?? [])
  const numberIndex = column(["ncliente", "numerocliente"])
  const nameIndex = column(["cliente", "nombre"])
  const typeIndex = column(["tipo"])
  const nodeIndex = column(["nodo"])
  const ipIndex = column(["ip"])
  const planIndex = column(["plan"])
  const statusIndex = column(["estado"])
  const amountIndex = column(["importe", "monto", "precio", "total", "abono", "final", "cuota"])
  if (numberIndex < 0 || planIndex < 0) throw new Error("Facturación no tiene N° Cliente y Plan.")
  return {
    headers: (matrix[0] ?? []).map((cell) => text(cell)),
    rows: matrix.slice(1).flatMap((row) => {
      const number = numberFromCell(row[numberIndex])
      if (!number) return []
      return [{
        number,
        name: nameIndex >= 0 ? text(row[nameIndex]) ?? "" : "",
        tipo: typeIndex >= 0 ? text(row[typeIndex]) ?? "" : "",
        nodo: nodeIndex >= 0 ? text(row[nodeIndex]) : null,
        ip: ipIndex >= 0 ? text(row[ipIndex]) : null,
        plan: text(row[planIndex]) ?? "",
        estado: statusIndex >= 0 ? text(row[statusIndex]) ?? "" : "",
        amount: amountIndex >= 0 ? amount(row[amountIndex]) : null,
      }]
    }),
  }
}

function baseCatalog(tipo, plan) {
  return mapAbnetResidentialCatalog(tipo, compactPlan(plan).replace(/jubilado/g, ""))
}

function planFamily(row) {
  const compact = compactPlan(row.plan)
  const type = fold(row.tipo)
  if (type === "tv plan" || compact.includes("tvpackfull")) return "tv"
  if (compact.includes("jubilado")) return "jubilado"
  if (compact.includes("empresa")) return "empresa"
  if (compact.includes("duplicado")) return "duplicado"
  if (compact.includes("dedicado")) return "dedicado"
  if (compact.includes("baja")) return "baja"
  if (compact.includes("25")) return "mb25"
  if (compact.includes("15")) return "mb15"
  if (mapAbnetResidentialCatalog(row.tipo, row.plan)) return "residential"
  if (["20mb+tvbasico", "50mb+tvbasico", "100mb+tvbasico", "300mb+tvbasico"].includes(compact)) {
    return "type_mismatch"
  }
  return "other"
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))]
}

function countCustomers(rows) {
  return new Set(rows.map((row) => row.number)).size
}

function serviceBrief(row, loadedKeys) {
  const loaded = loadedKeys.has(abnetExactInternetKey(row))
  return {
    tipo: row.tipo,
    nodo: row.nodo,
    plan: row.plan,
    estado: row.estado,
    tv: row.tv,
    finalAmount: row.finalAmount,
    loaded,
  }
}

function billingFor(number, billingByNumber) {
  return billingByNumber.get(number) ?? []
}

function billedLike(row, billingRows) {
  return billingRows.filter((item) => fold(item.tipo) === fold(row.tipo) && fold(item.nodo) === fold(row.nodo))
}

function customerBrief(customer) {
  if (!customer) return null
  return {
    id: customer.id,
    customerNumber: customer.customer_number,
    name: customer.name,
    dni: customer.dni,
    externalCustomerCode: customer.external_customer_code,
    status: customer.status,
    createdAt: customer.created_at,
  }
}

function taskBrief(task) {
  return {
    code: task.code,
    type: task.type,
    status: task.status,
    startDate: task.start_date,
    createdAt: task.created_at,
    title: task.title,
    contractedPlan: task.contracted_plan,
  }
}

function matrixRow(exception, rows, category, confidence, reason, recommendedNextStep, withService) {
  return {
    exception,
    customers: countCustomers(rows),
    rows: rows.length,
    withBespokeService: withService,
    review: category === "LOAD_CANDIDATE" ? 0 : countCustomers(rows),
    category,
    confidence,
    reason,
    recommended_next_step: recommendedNextStep,
  }
}

assertReadOnlyInvocation()

const internetRows = readInternetDetailed(DEFAULT_CONEX)
const billingFile = readBillingDetailed(DEFAULT_BILLING)
const billingRows = billingFile.rows
const masterRows = readAbnetMasterRows(MASTER_PATH)
const masterNumbers = new Set(masterRows.map((row) => numberFromCell(row.customerNumber)).filter(Boolean))
const masterByNumber = new Map(masterRows.map((row) => [numberFromCell(row.customerNumber), row]))

const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const db = { from: readOnlyFrom(client) }

const beforeServices = await fetchAll(db, "isp_services", "id")
const customers = await fetchAll(
  db,
  "customers",
  "id, customer_number, name, dni, external_customer_code, status, created_at, deleted_at"
)
const services = await fetchAll(
  db,
  "isp_services",
  "id, customer_id, catalog_code, commercial_status, plan_name, technology, external_code, monthly_fee, deleted_at"
)
const connections = await fetchAll(
  db,
  "isp_connections",
  "id, service_id, connection_type, ip_address, notes, external_code, deleted_at"
)
const tasks = await fetchAll(
  db,
  "tasks",
  "id, customer_id, code, type, status, start_date, created_at, title, contracted_plan, deleted_at"
)

const liveCustomers = customers.filter((row) => !row.deleted_at)
const liveServices = services.filter((row) => !row.deleted_at)
const liveConnections = connections.filter((row) => !row.deleted_at)
const liveTasks = tasks.filter((row) => !row.deleted_at)

const customersByNumber = new Map()
const customersByName = new Map()
const customersByDocument = new Map()
for (const row of liveCustomers) {
  const number = numberFromCell(row.external_customer_code)
  if (number) {
    const current = customersByNumber.get(number) ?? []
    current.push(row)
    customersByNumber.set(number, current)
  }
  const name = fold(row.name)
  if (name) {
    const current = customersByName.get(name) ?? []
    current.push(row)
    customersByName.set(name, current)
  }
  const document = documentDigits(row.dni)
  if (document && !PLACEHOLDER_DOCUMENTS.has(document)) {
    const current = customersByDocument.get(document) ?? []
    current.push(row)
    customersByDocument.set(document, current)
  }
}

const servicesByCustomer = new Map()
for (const row of liveServices) {
  const current = servicesByCustomer.get(row.customer_id) ?? []
  current.push(row)
  servicesByCustomer.set(row.customer_id, current)
}
const serviceById = new Map(liveServices.map((row) => [row.id, row]))
const connectionsByCustomer = new Map()
for (const row of liveConnections) {
  const service = serviceById.get(row.service_id)
  if (!service) continue
  const current = connectionsByCustomer.get(service.customer_id) ?? []
  current.push(row)
  connectionsByCustomer.set(service.customer_id, current)
}
const tasksByCustomer = new Map()
for (const row of liveTasks) {
  if (!row.customer_id) continue
  const current = tasksByCustomer.get(row.customer_id) ?? []
  current.push(row)
  tasksByCustomer.set(row.customer_id, current)
}
const loadedKeys = new Set(
  liveServices
    .map((row) => (row.external_code?.startsWith("abnet-cx:") ? row.external_code.slice("abnet-cx:".length) : null))
    .filter(Boolean)
)
const billingByNumber = new Map()
for (const row of billingRows) {
  const current = billingByNumber.get(row.number) ?? []
  current.push(row)
  billingByNumber.set(row.number, current)
}

const internet = internetRows.filter((row) => isInternetAccessType(row.tipo))
const collapsedInternet = collapseExactInternetCopies(internet)
const residential = collapsedInternet.kept.filter((row) => mapAbnetResidentialCatalog(row.tipo, row.plan))
const tvRows = internetRows.filter((row) => planFamily(row) === "tv")
const specials = collapsedInternet.kept.filter((row) => planFamily(row) !== "residential")

function linkedCustomers(number) {
  return customersByNumber.get(number) ?? []
}

function hasBespokeService(number) {
  return linkedCustomers(number).some((customer) => (servicesByCustomer.get(customer.id) ?? []).length > 0)
}

function bespokeCounts(number) {
  const linked = linkedCustomers(number)
  const serviceCount = linked.reduce((sum, customer) => sum + (servicesByCustomer.get(customer.id) ?? []).length, 0)
  const connectionCount = linked.reduce((sum, customer) => sum + (connectionsByCustomer.get(customer.id) ?? []).length, 0)
  return { customers: linked.map(customerBrief), services: serviceCount, connections: connectionCount }
}

function rowOutReason(row) {
  if (!mapAbnetResidentialCatalog(row.tipo, row.plan)) return `Plan fuera de los cuatro códigos: ${row.plan}`
  const link = customerIdForAbnetNumber(row.number, new Map([...customersByNumber].map(([n, rows]) => [n, rows.map((r) => r.id)])))
  if (!("customerId" in link)) return link.reason
  const status = fold(row.estado)
  if (status === "morosa" || status === "inactiva") return `Estado ${row.estado}: no se convirtió en baja ni en suspendido`
  if (loadedKeys.has(abnetExactInternetKey(row))) return "Cargado en la primera tanda"
  return "No cargado por otra regla"
}

const statusExcluded = residential.filter((row) => {
  const link = customerIdForAbnetNumber(row.number, new Map([...customersByNumber].map(([n, rows]) => [n, rows.map((r) => r.id)])))
  return "customerId" in link && (fold(row.estado) === "morosa" || fold(row.estado) === "inactiva")
})
const morosa = statusExcluded.filter((row) => fold(row.estado) === "morosa")
const inactiva = statusExcluded.filter((row) => fold(row.estado) === "inactiva")

function statusGroup(rows, label) {
  const numbers = unique(rows.map((row) => row.number))
  const withInvoice = numbers.filter((number) => billingFor(number, billingByNumber).length > 0)
  const withService = numbers.filter((number) => hasBespokeService(number))
  const withConnection = numbers.filter((number) => bespokeCounts(number).connections > 0)
  const multi = numbers.filter((number) => collapsedInternet.kept.filter((row) => row.number === number).length > 1)
  const billedAndOnlyThis = rows.filter((row) => billingFor(row.number, billingByNumber).length > 0 && !hasBespokeService(row.number))
  const unbilled = rows.filter((row) => billingFor(row.number, billingByNumber).length === 0)
  return {
    label,
    customers: numbers.length,
    rows: rows.length,
    connectionsInSource: rows.length,
    withOctoberInvoice: withInvoice.length,
    withBespokeService: withService.length,
    withBespokeConnection: withConnection.length,
    withMultipleInternet: multi.length,
    billedWithoutOtherService: countCustomers(billedAndOnlyThis),
    withoutOctoberInvoice: countCustomers(unbilled),
    billedCases: rows.filter((row) => billingFor(row.number, billingByNumber).length > 0).map((row) => ({
      number: row.number,
      name: row.name,
      tipo: row.tipo,
      nodo: row.nodo,
      plan: row.plan,
      estado: row.estado,
      billingPlans: unique(billingFor(row.number, billingByNumber).map((item) => item.plan)),
      bespoke: bespokeCounts(row.number),
    })),
    withServiceCases: rows.filter((row) => hasBespokeService(row.number)).map((row) => ({
      number: row.number,
      name: row.name,
      tipo: row.tipo,
      plan: row.plan,
      estado: row.estado,
      bespokeServices: bespokeCounts(row.number).services,
    })),
    sample: rows.slice(0, 8).map((row) => ({
      number: row.number,
      name: row.name,
      tipo: row.tipo,
      nodo: row.nodo,
      plan: row.plan,
      estado: row.estado,
      billed: billingFor(row.number, billingByNumber).map((item) => item.plan),
      bespoke: bespokeCounts(row.number),
    })),
  }
}

const multiNumbers = [...new Map(collapsedInternet.kept.map((row) => [row.number, row])).keys()]
  .filter((number) => collapsedInternet.kept.filter((row) => row.number === number).length > 1)

function multiShape(rows) {
  const types = new Set(rows.map((row) => fold(row.tipo)))
  if (types.has("wireless") && types.has("fibra")) return "wireless_fibra"
  if (types.size === 1 && types.has("fibra")) return "fibra_fibra"
  return "wireless_wireless"
}

function multiReading(rows) {
  const plans = new Set(rows.map((row) => compactPlan(row.plan)))
  const statuses = new Set(rows.map((row) => fold(row.estado)))
  const nodes = new Set(rows.map((row) => fold(row.nodo)))
  const types = new Set(rows.map((row) => fold(row.tipo)))
  const pendingOtherTech = rows.some((row) => fold(row.estado) === "pendiente") && types.size > 1
  if (pendingOtherTech) {
    return { reading: "cambio_de_tecnologia", confidence: "HIGH", category: "TECHNICAL_MODEL_REQUIRED" }
  }
  if (types.size > 1 && statuses.size === 1) {
    return { reading: "segundo_servicio", confidence: "MEDIUM", category: "TECHNICAL_MODEL_REQUIRED" }
  }
  if (plans.size === 1 && statuses.size > 1 && nodes.size === 1) {
    return { reading: "servicio_historico", confidence: "MEDIUM", category: "HISTORICAL" }
  }
  if (plans.size === 1 && statuses.size === 1) {
    return { reading: "duplicado_real", confidence: "LOW", category: "DO_NOT_LOAD_YET" }
  }
  if (plans.size > 1) {
    return { reading: "segundo_servicio", confidence: "MEDIUM", category: "TECHNICAL_MODEL_REQUIRED" }
  }
  return { reading: "revision_manual", confidence: "LOW", category: "DO_NOT_LOAD_YET" }
}

const multiCases = multiNumbers.map((number) => {
  const rows = collapsedInternet.kept.filter((row) => row.number === number)
  const billing = billingFor(number, billingByNumber)
  const reading = multiReading(rows)
  return {
    number,
    name: rows[0]?.name ?? "",
    shape: multiShape(rows),
    samePlan: new Set(rows.map((row) => compactPlan(row.plan))).size === 1,
    differentStatus: new Set(rows.map((row) => fold(row.estado))).size > 1,
    ...reading,
    services: rows.map((row) => ({
      ...serviceBrief(row, loadedKeys),
      reason: rowOutReason(row),
      inBilling: billedLike(row, billing).length > 0,
      billingPlans: unique(billedLike(row, billing).map((item) => item.plan)),
      ip: unique(billedLike(row, billing).map((item) => item.ip)),
    })),
    billingPlans: unique(billing.map((item) => item.plan)),
    bespoke: bespokeCounts(number),
  }
})

function tvPack(row) {
  const compact = compactPlan(row.plan)
  if (compact.includes("tvpackfull1")) return "TV PACK FULL 1"
  if (compact.includes("tvpackfull2")) return "TV PACK FULL 2"
  return row.plan
}

const tvGroups = ["TV PACK FULL 1", "TV PACK FULL 2"].map((label) => {
  const rows = tvRows.filter((row) => tvPack(row) === label && fold(row.tipo) === "tv plan")
  return tvSummary(label, rows)
})
const tvFibra = tvSummary("TV Pack Full en Fibra", tvRows.filter((row) => fold(row.tipo) === "fibra"))

function tvSummary(label, rows) {
  const numbers = unique(rows.map((row) => row.number))
  const withInternet = numbers.filter((number) => collapsedInternet.kept.some((row) => row.number === number))
  const onlyTv = numbers.filter((number) => !collapsedInternet.kept.some((row) => row.number === number))
  return {
    label,
    rows: rows.length,
    customers: numbers.length,
    inBilling: numbers.filter((number) => billingFor(number, billingByNumber).length > 0).length,
    inInternetTv: rows.length,
    withResidentialInternet: withInternet.length,
    withoutInternet: onlyTv.length,
    onlyTv: onlyTv.map((number) => ({
      number,
      name: rows.find((row) => row.number === number)?.name ?? "",
    })),
    tvAmounts: unique(rows.map((row) => row.tv)),
    finalAmounts: unique(rows.map((row) => row.finalAmount)),
    withBespokeService: numbers.filter((number) => hasBespokeService(number)).length,
    sample: rows.slice(0, 5).map((row) => ({
      number: row.number,
      name: row.name,
      tipo: row.tipo,
      plan: row.plan,
      estado: row.estado,
      tv: row.tv,
      finalAmount: row.finalAmount,
      internetPlans: collapsedInternet.kept.filter((item) => item.number === row.number).map((item) => `${item.tipo} ${item.plan} ${item.estado}`),
      bespoke: bespokeCounts(row.number).services,
    })),
  }
}

const jubiladoRows = specials.filter((row) => planFamily(row) === "jubilado")
const jubiladoCases = jubiladoRows.map((row) => {
  const catalog = baseCatalog(row.tipo, row.plan)
  const price = catalog ? CATALOG_PRICE[catalog] : null
  const half = price == null ? null : price / 2
  const billing = billingFor(row.number, billingByNumber)
  return {
    number: row.number,
    name: row.name,
    tipo: row.tipo,
    nodo: row.nodo,
    plan: row.plan,
    estado: row.estado,
    tv: row.tv,
    finalAmount: row.finalAmount,
    baseCatalog: catalog,
    catalogPrice: price,
    halfCatalogPrice: half,
    finalMatchesHalfCatalog: price != null && row.finalAmount != null && Math.abs(row.finalAmount - half) < 1,
    billingPlans: unique(billing.map((item) => item.plan)),
    billingAmounts: unique(billing.map((item) => item.amount)),
    inBilling: billing.length > 0,
    bespoke: bespokeCounts(row.number),
    loaded: loadedKeys.has(abnetExactInternetKey(row)),
  }
})

function empresaSpeed(plan) {
  const match = compactPlan(plan).match(/(\d{2,3})/)
  return match ? `${match[1]} Mbps` : "otros"
}

const empresaRows = specials.filter((row) => planFamily(row) === "empresa")
const empresaCases = empresaRows.map((row) => ({
  number: row.number,
  name: row.name,
  tipo: row.tipo,
  nodo: row.nodo,
  plan: row.plan,
  speed: empresaSpeed(row.plan),
  typeNameAgrees: !(fold(row.plan).includes("fibra") && fold(row.tipo) === "wireless") && !(fold(row.plan).includes("wireless") && fold(row.tipo) === "fibra"),
  estado: row.estado,
  tv: row.tv,
  finalAmount: row.finalAmount,
  billingPlans: unique(billingFor(row.number, billingByNumber).map((item) => item.plan)),
  billingAmounts: unique(billingFor(row.number, billingByNumber).map((item) => item.amount)),
  inBilling: billingFor(row.number, billingByNumber).length > 0,
  bespoke: bespokeCounts(row.number),
}))

function simpleGroup(label, rows) {
  const numbers = unique(rows.map((row) => row.number))
  return {
    label,
    rows: rows.length,
    customers: numbers.length,
    statuses: Object.fromEntries(rows.reduce((map, row) => map.set(fold(row.estado) || "(vacío)", (map.get(fold(row.estado)) ?? 0) + 1), new Map())),
    inBilling: numbers.filter((number) => billingFor(number, billingByNumber).length > 0).length,
    withCustomer: numbers.filter((number) => linkedCustomers(number).length === 1).length,
    withBespokeService: numbers.filter((number) => hasBespokeService(number)).length,
    plans: unique(rows.map((row) => `${row.tipo} | ${row.plan}`)),
    cases: rows.map((row) => ({
      number: row.number,
      name: row.name,
      tipo: row.tipo,
      nodo: row.nodo,
      plan: row.plan,
      estado: row.estado,
      inBilling: billingFor(row.number, billingByNumber).length > 0,
      billingPlans: unique(billingFor(row.number, billingByNumber).map((item) => item.plan)),
      bespoke: bespokeCounts(row.number),
    })),
  }
}

const mb25 = simpleGroup("25 Mb", specials.filter((row) => planFamily(row) === "mb25"))
const mb15 = simpleGroup("15 Mb", specials.filter((row) => planFamily(row) === "mb15"))
const dedicado = simpleGroup("Dedicado", specials.filter((row) => planFamily(row) === "dedicado"))
const baja = simpleGroup("Conexión en baja", specials.filter((row) => planFamily(row) === "baja"))
const otherVariants = simpleGroup(
  "Otras variantes",
  specials.filter((row) => planFamily(row) === "type_mismatch" || planFamily(row) === "other")
)

const duplicateBilling = billingRows.filter((row) => compactPlan(row.plan).includes("duplicado"))
const duplicateNumbers = unique([
  ...duplicateBilling.map((row) => row.number),
  ...internetRows.filter((row) => compactPlan(row.plan).includes("duplicado")).map((row) => row.number),
])
const duplicateCases = duplicateNumbers.map((number) => ({
  number,
  name: billingFor(number, billingByNumber)[0]?.name || internetRows.find((row) => row.number === number)?.name || "",
  internet: collapsedInternet.kept.filter((row) => row.number === number).map((row) => serviceBrief(row, loadedKeys)),
  billing: billingFor(number, billingByNumber).map((row) => ({
    tipo: row.tipo,
    nodo: row.nodo,
    plan: row.plan,
    estado: row.estado,
    ip: row.ip,
    amount: row.amount,
  })),
  bespoke: bespokeCounts(number),
}))

const noCustomerRows = residential.filter((row) => linkedCustomers(row.number).length === 0)
function identityClass(row) {
  const master = masterByNumber.get(row.number)
  const document = documentDigits(master?.document)
  const documentHits = document && !PLACEHOLDER_DOCUMENTS.has(document) ? customersByDocument.get(document) ?? [] : []
  const documentConflict = documentHits.filter((customer) => {
    const existing = numberFromCell(customer.external_customer_code)
    return existing != null && existing !== row.number
  })
  const documentCandidates = documentHits.filter((customer) => !numberFromCell(customer.external_customer_code))
  const nameHits = (customersByName.get(fold(row.name)) ?? []).filter((customer) => !numberFromCell(customer.external_customer_code))
  if (documentConflict.length > 0) {
    return {
      bucket: "customer con conflicto de N° ABNet",
      candidates: documentConflict.map(customerBrief),
      evidence: "El DNI/CUIT del maestro coincide con un customer que ya tiene otro N° ABNet. No es un vínculo.",
    }
  }
  if (documentCandidates.length === 1) {
    return {
      bucket: "customer candidato",
      candidates: documentCandidates.map(customerBrief),
      evidence: "El DNI/CUIT del maestro coincide con un customer sin N° ABNet. No se asigna el número: el cruce de DNI quedó para revisión.",
    }
  }
  if (documentCandidates.length > 1) {
    return {
      bucket: "más de un customer candidato",
      candidates: documentCandidates.map(customerBrief),
      evidence: "El DNI/CUIT del maestro coincide con más de un customer sin N° ABNet.",
    }
  }
  if (nameHits.length === 1) {
    return {
      bucket: "customer candidato",
      candidates: nameHits.map(customerBrief),
      evidence: "Hay un solo customer sin N° ABNet con el mismo nombre normalizado. El nombre no alcanza para vincular.",
    }
  }
  if (nameHits.length > 1) {
    return {
      bucket: "más de un customer candidato",
      candidates: nameHits.map(customerBrief),
      evidence: "Varios customers sin N° ABNet comparten el nombre. No se elige uno.",
    }
  }
  return {
    bucket: "sin customer",
    candidates: [],
    evidence: master ? "Está en el maestro y no tiene customer Bespoke con ese N°." : "No está en el maestro ni tiene customer Bespoke con ese N°.",
    inMaster: Boolean(master),
  }
}
const identityRows = noCustomerRows.map((row) => ({
  number: row.number,
  name: row.name,
  tipo: row.tipo,
  nodo: row.nodo,
  plan: row.plan,
  estado: row.estado,
  inMaster: masterNumbers.has(row.number),
  inBilling: billingFor(row.number, billingByNumber).length > 0,
  ...identityClass(row),
}))
const identityBuckets = ["sin customer", "customer candidato", "más de un customer candidato", "customer con conflicto de N° ABNet"].map((bucket) => {
  const rows = identityRows.filter((row) => row.bucket === bucket)
  return {
    bucket,
    rows: rows.length,
    customers: countCustomers(rows),
    examples: rows.slice(0, 6).map((row) => ({
      number: row.number,
      name: row.name,
      plan: row.plan,
      estado: row.estado,
      inMaster: row.inMaster,
      inBilling: row.inBilling,
      evidence: row.evidence,
      candidates: row.candidates,
    })),
    evidence: Object.fromEntries(rows.reduce((map, row) => map.set(row.evidence, (map.get(row.evidence) ?? 0) + 1), new Map())),
  }
})

const ambiguousNumbers = [...customersByNumber.entries()].filter(([, rows]) => rows.length > 1).map(([number]) => number)
const ambiguousCases = ambiguousNumbers.map((number) => {
  const linked = linkedCustomers(number)
  const internetForNumber = collapsedInternet.kept.filter((row) => row.number === number)
  return {
    number,
    masterName: masterByNumber.get(number)?.name ?? null,
    masterDocument: masterByNumber.get(number)?.document ?? null,
    customers: linked.map((customer) => ({
      ...customerBrief(customer),
      services: (servicesByCustomer.get(customer.id) ?? []).map((service) => ({
        catalog: service.catalog_code,
        status: service.commercial_status,
        externalCode: service.external_code,
      })),
      connections: (connectionsByCustomer.get(customer.id) ?? []).length,
      tasks: (tasksByCustomer.get(customer.id) ?? []).map(taskBrief),
    })),
    internet: internetForNumber.map((row) => serviceBrief(row, loadedKeys)),
    billing: billingFor(number, billingByNumber).map((row) => ({ plan: row.plan, tipo: row.tipo, estado: row.estado, ip: row.ip })),
    needed: "Hace falta un dato que distinga a las dos fichas: DNI de cada una, domicilio, o cuál debe conservar el N° ABNet. El nombre repetido no alcanza.",
  }
})

const caseC = CASE_C.map((number) => ({
  number,
  master: masterByNumber.get(number) ? { name: masterByNumber.get(number).name, document: masterByNumber.get(number).document } : null,
  internetRows: internetRows.filter((row) => row.number === number).length,
  billingRows: billingFor(number, billingByNumber).length,
  bespoke: bespokeCounts(number),
}))

const rangeBilling = billingRows.filter((row) => {
  const value = Number(row.number)
  return value >= 6800 && value <= 6827
})
const rangeNumbers = unique(rangeBilling.map((row) => row.number))
const rangeCases = rangeNumbers.map((number) => {
  const billing = billingFor(number, billingByNumber)
  const name = billing[0]?.name ?? ""
  const exact = (customersByName.get(fold(name)) ?? []).filter((customer) => !numberFromCell(customer.external_customer_code))
  const anyName = customersByName.get(fold(name)) ?? []
  return {
    number,
    billingName: name,
    plans: unique(billing.map((row) => row.plan)),
    tipos: unique(billing.map((row) => row.tipo)),
    nodos: unique(billing.map((row) => row.nodo)),
    ips: unique(billing.map((row) => row.ip)),
    estados: unique(billing.map((row) => row.estado)),
    inMaster: masterNumbers.has(number),
    inInternetTv: internetRows.some((row) => row.number === number),
    unnamedExternalMatches: exact.map((customer) => ({
      ...customerBrief(customer),
      tasks: (tasksByCustomer.get(customer.id) ?? []).map(taskBrief),
    })),
    otherNameMatches: anyName.filter((customer) => numberFromCell(customer.external_customer_code)).map(customerBrief),
  }
})
const namedRange = rangeCases.filter((row) => row.unnamedExternalMatches.length === 1 && row.otherNameMatches.length === 0)
const unmatchedRange = rangeCases.filter((row) => row.unnamedExternalMatches.length === 0)
const ambiguousNameRange = rangeCases.filter((row) => !namedRange.includes(row) && !unmatchedRange.includes(row))

const outsideMaster = OUTSIDE_MASTER.map((number) => {
  const internetForNumber = collapsedInternet.kept.filter((row) => row.number === number)
  const linked = linkedCustomers(number)
  const recentTasks = linked.flatMap((customer) => (tasksByCustomer.get(customer.id) ?? []).filter((task) => task.start_date >= "2026-09-22" || task.created_at >= "2026-09-22"))
  return {
    number,
    name: internetForNumber[0]?.name ?? billingFor(number, billingByNumber)[0]?.name ?? "",
    inMaster: masterNumbers.has(number),
    internet: internetForNumber.map((row) => serviceBrief(row, loadedKeys)),
    billing: billingFor(number, billingByNumber).map((row) => ({ plan: row.plan, estado: row.estado, tipo: row.tipo, ip: row.ip })),
    bespoke: bespokeCounts(number),
    recentTasks: recentTasks.map(taskBrief),
  }
})

const morosaStats = statusGroup(morosa, "Morosa")
const inactivaStats = statusGroup(inactiva, "Inactiva")
const multiByShape = {
  wireless_fibra: multiCases.filter((row) => row.shape === "wireless_fibra").length,
  fibra_fibra: multiCases.filter((row) => row.shape === "fibra_fibra").length,
  wireless_wireless: multiCases.filter((row) => row.shape === "wireless_wireless").length,
  samePlan: multiCases.filter((row) => row.samePlan).length,
  differentPlan: multiCases.filter((row) => !row.samePlan).length,
  differentStatus: multiCases.filter((row) => row.differentStatus).length,
}
const multiByReading = multiCases.reduce((map, row) => {
  map.set(row.reading, (map.get(row.reading) ?? 0) + 1)
  return map
}, new Map())

const empresaByTypeSpeed = empresaCases.reduce((map, row) => {
  const key = `${row.tipo} ${row.speed}`
  map.set(key, (map.get(key) ?? 0) + 1)
  return map
}, new Map())

function withServiceCount(rows) {
  return unique(rows.map((row) => row.number)).filter((number) => hasBespokeService(number)).length
}

const matrix = [
  matrixRow(
    "Morosa con factura de octubre",
    morosa.filter((row) => billingFor(row.number, billingByNumber).length > 0),
    "BILLING_REVIEW",
    "MEDIUM",
    "Internet + TV dice Morosa y octubre igual los factura como Activa. No es una baja.",
    "Definir si la mora convive con el servicio activo o si hace falta un estado moroso distinto de suspendido.",
    withServiceCount(morosa.filter((row) => billingFor(row.number, billingByNumber).length > 0))
  ),
  matrixRow(
    "Morosa sin factura de octubre",
    morosa.filter((row) => billingFor(row.number, billingByNumber).length === 0),
    "COMMERCIAL_MODEL_REQUIRED",
    "MEDIUM",
    "La mora no está facturada en octubre. Suspendido sería una interpretación; el modelo actual no tiene estado moroso.",
    "Decidir el estado comercial antes de cargar. No convertirlo en baja.",
    withServiceCount(morosa.filter((row) => billingFor(row.number, billingByNumber).length === 0))
  ),
  matrixRow(
    "Inactiva",
    inactiva,
    "DO_NOT_LOAD_YET",
    "LOW",
    "Inactiva no trae fecha de baja ni retiro de equipo. No se interpreta como baja definitiva.",
    "Revisión manual de cada fila antes de elegir activo, inactivo o baja.",
    withServiceCount(inactiva)
  ),
  matrixRow(
    "Múltiples Internet",
    multiNumbers.flatMap((number) => collapsedInternet.kept.filter((row) => row.number === number)),
    "TECHNICAL_MODEL_REQUIRED",
    "MEDIUM",
    "Hay pares Wireless/Fibra y estados distintos. Parte ya se cargó. No hay una regla para elegir un solo servicio.",
    "Conservar los pares. No fusionar ni borrar en el próximo sprint.",
    multiCases.filter((row) => row.bespoke.services > 0).length
  ),
  matrixRow(
    "TV Pack Full",
    tvRows,
    "COMMERCIAL_MODEL_REQUIRED",
    "HIGH",
    "Es un adicional sobre un Internet, salvo los pocos que no tienen Internet. El catálogo ya tiene un upgrade TV Full, pero esta auditoría no elige la representación.",
    "Estudiar componente, upgrade o servicio aparte con estos precios y planes. No cargarlo todavía.",
    unique(tvRows.map((row) => row.number)).filter((number) => hasBespokeService(number)).length
  ),
  matrixRow(
    "Jubilado",
    jubiladoRows,
    "COMMERCIAL_MODEL_REQUIRED",
    jubiladoCases.every((row) => row.baseCatalog) ? "HIGH" : "MEDIUM",
    "El nombre del plan es un abono base más la condición JUBILADO. El 50% se compara contra el precio de catálogo, no contra el Excel.",
    "Preparar la condición JUBILADO al 50% sobre el plan base indicado, sin crear el descuento en este sprint.",
    withServiceCount(jubiladoRows)
  ),
  matrixRow(
    "Empresa",
    empresaRows,
    "COMMERCIAL_MODEL_REQUIRED",
    "MEDIUM",
    "Las velocidades y el tipo no entran en los cuatro planes residenciales. Algunas filas dicen fibra en el plan y Wireless en el tipo.",
    "Definir catálogo empresarial o marcar revisión manual donde el tipo no coincide con el nombre.",
    withServiceCount(empresaRows)
  ),
  matrixRow(
    "25 Mb",
    specials.filter((row) => planFamily(row) === "mb25"),
    "DO_NOT_LOAD_YET",
    "HIGH",
    "Velocidad histórica. No hay código residencial equivalente y no se reasigna a 20 Mb.",
    "Dejar fuera hasta definir si existe un plan histórico.",
    withServiceCount(specials.filter((row) => planFamily(row) === "mb25"))
  ),
  matrixRow(
    "15 Mb",
    specials.filter((row) => planFamily(row) === "mb15"),
    "DO_NOT_LOAD_YET",
    "HIGH",
    "Velocidad histórica, distinta de Empresa 15 Mbps.",
    "Dejar fuera. No mapear a otro plan.",
    withServiceCount(specials.filter((row) => planFamily(row) === "mb15"))
  ),
  matrixRow(
    "Dedicado",
    specials.filter((row) => planFamily(row) === "dedicado"),
    "COMMERCIAL_MODEL_REQUIRED",
    "LOW",
    "Un solo servicio dedicado. No hay producto equivalente en el catálogo residencial.",
    "Revisión comercial antes de crear un código.",
    withServiceCount(specials.filter((row) => planFamily(row) === "dedicado"))
  ),
  matrixRow(
    "Conexión en baja",
    specials.filter((row) => planFamily(row) === "baja"),
    "DO_NOT_LOAD_YET",
    "HIGH",
    "El plan se llama conexión en baja. No es uno de los cuatro abonos.",
    "No cargarlo como servicio activo.",
    withServiceCount(specials.filter((row) => planFamily(row) === "baja"))
  ),
  matrixRow(
    "Otras variantes de plan o tipo",
    specials.filter((row) => planFamily(row) === "type_mismatch" || planFamily(row) === "other"),
    "DO_NOT_LOAD_YET",
    "MEDIUM",
    "El plan residencial no coincide con el tipo, o el texto no entra en ninguna familia conocida.",
    "Revisión manual. No corregir el tipo por el nombre del plan.",
    withServiceCount(specials.filter((row) => planFamily(row) === "type_mismatch" || planFamily(row) === "other"))
  ),
  matrixRow(
    "Planes DUPLICADO",
    duplicateNumbers.map((number) => ({ number })),
    "BILLING_REVIEW",
    "HIGH",
    "DUPLICADO aparece en la factura con otra velocidad que la fila de Internet + TV. El servicio residencial de Internet + TV puede estar ya cargado.",
    "No corregir la factura ni cambiar el servicio cargado hasta revisar cada par.",
    duplicateCases.filter((row) => row.bespoke.services > 0).length
  ),
  matrixRow(
    "Sin customer Bespoke",
    noCustomerRows,
    "IDENTITY_REVIEW",
    "HIGH",
    "El N° ABNet no tiene un único customer. Un nombre igual no se usa para crear ni reasignar el número.",
    "Resolver la identidad con DNI o ficha existente antes de cargar el servicio.",
    0
  ),
  matrixRow(
    "N° ABNet en más de un customer",
    ambiguousNumbers.map((number) => ({ number })),
    "IDENTITY_REVIEW",
    "HIGH",
    "Siete números siguen duplicados en Bespoke. La carga los omitió para no elegir una ficha.",
    "Conseguir el dato que distinga cada par. No fusionar en el próximo sprint sin esa definición.",
    ambiguousCases.filter((row) => row.customers.some((customer) => customer.services.length > 0)).length
  ),
  matrixRow(
    "Caso C, solo maestro",
    CASE_C.map((number) => ({ number })),
    "DO_NOT_LOAD_YET",
    "HIGH",
    "Están en el maestro y en Bespoke, sin fila de Internet + TV ni de facturación.",
    "No crear servicio ni conexión hasta que exista una fuente técnica.",
    caseC.filter((row) => row.bespoke.services > 0).length
  ),
  matrixRow(
    "6800–6827 con un nombre igual",
    namedRange.map((row) => ({ number: row.number })),
    "IDENTITY_REVIEW",
    "MEDIUM",
    "La factura coincide en nombre con un alta reciente sin N° ABNet. El nombre solo no autoriza a escribir el código.",
    "Confirmar cada par con DNI o con la OT antes de guardar external_customer_code.",
    namedRange.filter((row) => row.unnamedExternalMatches.some((customer) => (servicesByCustomer.get(customer.id) ?? []).length > 0)).length
  ),
  matrixRow(
    "6800–6827 sin nombre igual",
    unmatchedRange.map((row) => ({ number: row.number })),
    "IDENTITY_REVIEW",
    "HIGH",
    "No hay customer sin número con el mismo nombre, ni fila en el maestro o en Internet + TV.",
    "Dejarlos sin vínculo. No crear customer desde la factura.",
    0
  ),
  matrixRow(
    "Doce números fuera del maestro actual",
    OUTSIDE_MASTER.map((number) => ({ number })),
    "HISTORICAL",
    "HIGH",
    "Están en Bespoke e Internet + TV y no en el maestro vigente. No se dan de baja por faltar en ese archivo.",
    "Mantener el servicio ya cargado si la fila era residencial Activa o Pendiente. No inventar una baja.",
    outsideMaster.filter((row) => row.bespoke.services > 0).length
  ),
]

const report = {
  readOnly: true,
  operations: ["select"],
  excelWrite: false,
  billingHeaders: billingFile.headers,
  gates: {
    internetRows: internetRows.length,
    collapsedInternet: collapsedInternet.kept.length,
    exactExtraInternet: collapsedInternet.extraCopies,
    residentialCollapsed: residential.length,
    statusExcluded: statusExcluded.length,
    morosa: morosa.length,
    inactiva: inactiva.length,
    multiCustomers: multiCases.length,
    noCustomerRows: noCustomerRows.length,
    ambiguousCustomerRows: residential.filter((row) => linkedCustomers(row.number).length > 1).length,
    ambiguousNumbers: ambiguousNumbers.length,
    loadedServices: liveServices.length,
    loadedConnections: liveConnections.length,
    customers: liveCustomers.length,
    tasks: liveTasks.length,
  },
  summary: matrix.map((row) => ({
    exception: row.exception,
    customers: row.customers,
    rows: row.rows,
    withBespokeService: row.withBespokeService,
    review: row.review,
    category: row.category,
    confidence: row.confidence,
  })),
  matrix,
  blocks: {
    morosa: morosaStats,
    inactiva: inactivaStats,
    multi: { counts: multiByShape, readings: Object.fromEntries(multiByReading), cases: multiCases },
    tv: { groups: tvGroups, fibra: tvFibra },
    jubilado: jubiladoCases,
    empresa: { byTypeSpeed: Object.fromEntries(empresaByTypeSpeed), cases: empresaCases },
    mb25,
    mb15,
    dedicado,
    baja,
    otherVariants,
    duplicado: duplicateCases,
    identity: { rows: noCustomerRows.length, customers: countCustomers(noCustomerRows), buckets: identityBuckets },
    ambiguous: ambiguousCases,
    caseC,
    range6800: { named: namedRange, unmatched: unmatchedRange, other: ambiguousNameRange },
    outsideMaster,
  },
}

const afterServices = await fetchAll(db, "isp_services", "id")
const afterConnections = await fetchAll(db, "isp_connections", "id")
const afterCustomers = await fetchAll(db, "customers", "id")
const afterTasks = await fetchAll(db, "tasks", "id")
report.unchanged = {
  services: beforeServices.length === afterServices.length && afterServices.length === liveServices.length,
  connections: afterConnections.length === connections.length,
  customers: afterCustomers.length === customers.length,
  tasks: afterTasks.length === tasks.length,
}

console.log(JSON.stringify(report, null, 2))
if (!report.unchanged.services || !report.unchanged.connections || !report.unchanged.customers || !report.unchanged.tasks) {
  process.exit(1)
}
