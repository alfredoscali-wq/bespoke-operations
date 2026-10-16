/**
 * Auditoría de solo lectura de los 212 casos ABNet con un único customer
 * candidato por DNI y sin N° ABNet. No asigna números ni escribe en la base.
 *
 * Uso: npx tsx scripts/abnet-dni-identity-audit.mjs
 */
import { createRequire } from "node:module"
import { createClient } from "@supabase/supabase-js"

import {
  abnetNumberFromExternalCode,
  documentDigits,
  isReliableIdentityDocument,
  packAbnetLocality,
} from "../lib/isp/abnet-master-universe.ts"
import {
  collapseExactInternetCopies,
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
  readInternetRows,
} from "./abnet-residential-sources.mjs"

const MASTER_PATH = "C:\\Users\\alfre\\Downloads\\BASE CLIENTES.xlsx"
const RECENT_SINCE = "2026-09-01"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

function assertReadOnlyInvocation() {
  if (process.argv.some((arg) => ["--apply", "--write", "--execute"].includes(arg))) {
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

function blank(value) {
  return value == null || String(value).trim() === ""
}

function clean(value) {
  return blank(value) ? null : String(value).trim()
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "")
}

function comparablePhone(value) {
  let current = digits(value)
  if (current.startsWith("54")) current = current.slice(2)
  if (current.startsWith("9") && current.length >= 11) current = current.slice(1)
  return current.replace(/^0+/, "")
}

function tokens(value) {
  return fold(value).split(" ").filter((token) => token.length > 1)
}

function editDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])
  for (let column = 1; column <= right.length; column += 1) rows[0][column] = column
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
    }
  }
  return rows[left.length][right.length]
}

function nameRelation(left, right) {
  const a = tokens(left)
  const b = tokens(right)
  if (a.length === 0 || b.length === 0) return "missing"
  if (a.join(" ") === b.join(" ")) return "same"
  const setA = new Set(a)
  const setB = new Set(b)
  const shared = a.filter((token) => setB.has(token))
  const onlyA = a.filter((token) => !setB.has(token))
  const onlyB = b.filter((token) => !setA.has(token))
  if (onlyA.length === 0 && onlyB.length === 0) return "minimal"
  if (shared.length >= 2 && onlyA.length + onlyB.length === 1) return "minimal"
  if (
    shared.length >= 1 &&
    onlyA.length === 1 &&
    onlyB.length === 1 &&
    Math.min(onlyA[0].length, onlyB[0].length) >= 4 &&
    editDistance(onlyA[0], onlyB[0]) <= 2
  ) {
    return "minimal"
  }
  if (shared.length === 0) return "incompatible"
  return "partial"
}

function phoneRelation(left, right) {
  if (blank(left) || blank(right)) return "missing"
  const a = comparablePhone(left)
  const b = comparablePhone(right)
  if (a.length >= 6 && a === b) return "same"
  return "different"
}

function emailRelation(left, right) {
  if (blank(left) || blank(right)) return "missing"
  return clean(left).toLowerCase() === clean(right).toLowerCase() ? "same" : "different"
}

function addressRelation(left, right) {
  if (blank(left) || blank(right)) return "missing"
  const a = fold(left)
  const b = fold(right)
  if (a === b) return "same"
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return "same"
  return "different"
}

function localityRelation(locality, city, province) {
  const current = fold(locality)
  const cityFold = fold(city)
  const provinceFold = fold(province)
  if (!current || !cityFold) return "missing"
  if (current === cityFold || current.startsWith(`${cityFold} `) || current.includes(cityFold)) return "same"
  if (provinceFold && current === provinceFold && cityFold !== provinceFold) return "province_only"
  return "different"
}

function readBilling(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos") ? "Datos" : workbook.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true })
  return matrix.slice(1).flatMap((row) => {
    const number = abnetNumberFromExternalCode(row[0] == null ? null : String(row[0]).trim())
    if (!number) return []
    const text = (value) => clean(value)
    return [{
      number,
      name: text(row[1]) ?? "",
      tipo: text(row[2]),
      nodo: text(row[3]),
      ip: text(row[4]),
      plan: text(row[5]),
      estado: text(row[6]),
    }]
  })
}

function taskLooksRecent(task) {
  return String(task.start_date ?? "") >= RECENT_SINCE || String(task.created_at ?? "") >= RECENT_SINCE
}

function taskSupportsTechnology(task, tipo) {
  const type = fold(task.type)
  const technology = fold(tipo)
  if (technology === "fibra") return type.includes("fiber") || type.includes("fibra") || type.includes("ftth")
  if (technology === "wireless") return type.includes("wireless")
  return false
}

/**
 * Un caso del grupo de 212 tiene un único customer sin N° ABNet y el mismo DNI.
 * MATCH_SEGURO exige además nombre compatible y un contacto que coincida.
 * Una OT reciente se informa, pero no alcanza para MATCH_SEGURO.
 */
export function classifyDniCase(input) {
  const conflicts = []
  const support = []
  if (input.candidates.length > 1) {
    return { classification: "REVIEW_MULTIPLE_CUSTOMERS", conflicts: ["Más de un customer sin N° ABNet comparte el DNI."], support }
  }
  const customer = input.candidates[0]
  if (!customer) return { classification: "NO_MATCH", conflicts: ["No hay candidato."], support }
  if (input.takenNumbers.length > 0) {
    conflicts.push(`El DNI ya está en el N° ABNet ${input.takenNumbers.join(", ")}.`)
  }
  if (abnetNumberFromExternalCode(customer.external_customer_code)) {
    conflicts.push("El customer candidato ya tiene N° ABNet.")
  }
  const name = nameRelation(input.abnetName, customer.name)
  if (name === "same" || name === "minimal") support.push(name === "same" ? "Nombre igual" : "Nombre con diferencia mínima")
  if (name === "partial") conflicts.push("El nombre solo comparte parte de los tokens.")
  if (name === "incompatible") conflicts.push("El nombre no comparte tokens.")
  if (name === "missing") conflicts.push("Falta el nombre en uno de los lados.")

  const phone = phoneRelation(input.master.phone, customer.phone)
  const email = emailRelation(input.master.email, customer.email)
  const address = addressRelation(input.master.address, customer.address)
  const locality = localityRelation(customer.locality, input.master.city, input.master.province)
  if (phone === "same") support.push("Teléfono igual")
  if (email === "same") support.push("Email igual")
  if (address === "same") support.push("Domicilio igual")
  if (locality === "same") support.push("Localidad igual")
  if (phone === "different") conflicts.push("Teléfono distinto")
  if (email === "different") conflicts.push("Email distinto")
  if (address === "different") conflicts.push("Domicilio distinto")
  if (locality === "different") conflicts.push("Localidad distinta")
  if (input.recentCompatibleOt) support.push("OT reciente compatible con la tecnología")
  if (input.serviceSupportsPlan) support.push("Servicio Bespoke coincide en plan y tipo")

  const contactSupport = support.some((item) => ["Teléfono igual", "Email igual", "Domicilio igual", "Localidad igual"].includes(item))
  const nameOk = name === "same" || name === "minimal"
  const hardConflict = conflicts.some((item) => !item.startsWith("El nombre solo comparte") && !item.startsWith("Falta el nombre"))

  if (conflicts.some((item) => item.startsWith("El DNI ya está") || item.startsWith("El customer candidato ya tiene"))) {
    return { classification: "REVIEW_CONFLICT", conflicts, support, name, phone, email, address, locality }
  }
  if (phone === "different" || email === "different" || address === "different" || locality === "different" || name === "partial") {
    return { classification: "REVIEW_CONFLICT", conflicts, support, name, phone, email, address, locality }
  }
  if (name === "incompatible") {
    return { classification: "NO_MATCH", conflicts, support, name, phone, email, address, locality }
  }
  if (nameOk && contactSupport && !hardConflict) {
    return { classification: "MATCH_SEGURO", conflicts, support, name, phone, email, address, locality }
  }
  if (nameOk) {
    return { classification: "MATCH_PROBABLE", conflicts, support, name, phone, email, address, locality }
  }
  return { classification: "REVIEW_ONLY_DNI", conflicts, support, name, phone, email, address, locality }
}

assertReadOnlyInvocation()

const masterRows = readAbnetMasterRows(MASTER_PATH)
const internetRows = readInternetRows(DEFAULT_CONEX)
const billingRows = readBilling(DEFAULT_BILLING)
const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const db = { from: readOnlyFrom(client) }

const before = {
  customers: await fetchAll(db, "customers", "id"),
  services: await fetchAll(db, "isp_services", "id"),
  connections: await fetchAll(db, "isp_connections", "id"),
  tasks: await fetchAll(db, "tasks", "id"),
}
const customers = await fetchAll(
  db,
  "customers",
  "id, customer_number, name, dni, email, phone, address, locality, external_customer_code, created_at, deleted_at"
)
const services = await fetchAll(
  db,
  "isp_services",
  "id, customer_id, catalog_code, commercial_status, monthly_fee, technology, deleted_at"
)
const connections = await fetchAll(
  db,
  "isp_connections",
  "id, service_id, connection_type, ip_address, notes, technical_status, deleted_at"
)
const tasks = await fetchAll(
  db,
  "tasks",
  "id, customer_id, code, type, status, start_date, created_at, title, description, deleted_at"
)

const liveCustomers = customers.filter((row) => !row.deleted_at)
const liveServices = services.filter((row) => !row.deleted_at)
const liveConnections = connections.filter((row) => !row.deleted_at)
const liveTasks = tasks.filter((row) => !row.deleted_at)

const masterByNumber = new Map()
for (const row of masterRows) {
  const number = abnetNumberFromExternalCode(row.customerNumber)
  if (!number) continue
  const current = masterByNumber.get(number) ?? []
  current.push(row)
  masterByNumber.set(number, current)
}
const customersByNumber = new Map()
const customersByDocument = new Map()
for (const row of liveCustomers) {
  const number = abnetNumberFromExternalCode(row.external_customer_code)
  if (number) {
    const current = customersByNumber.get(number) ?? []
    current.push(row)
    customersByNumber.set(number, current)
  }
  if (!isReliableIdentityDocument(row.dni)) continue
  const document = documentDigits(row.dni)
  const current = customersByDocument.get(document) ?? []
  current.push(row)
  customersByDocument.set(document, current)
}
const billingByNumber = new Map()
for (const row of billingRows) {
  const current = billingByNumber.get(row.number) ?? []
  current.push(row)
  billingByNumber.set(row.number, current)
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
  current.push({ ...row, catalogCode: service.catalog_code })
  connectionsByCustomer.set(service.customer_id, current)
}
const tasksByCustomer = new Map()
for (const row of liveTasks) {
  if (!row.customer_id) continue
  const current = tasksByCustomer.get(row.customer_id) ?? []
  current.push(row)
  tasksByCustomer.set(row.customer_id, current)
}

const residential = collapseExactInternetCopies(
  internetRows.filter((row) => isInternetAccessType(row.tipo) && mapAbnetResidentialCatalog(row.tipo, row.plan))
)
const unresolved = residential.kept.filter((row) => (customersByNumber.get(row.number) ?? []).length === 0)

function documentHitsFor(number) {
  const master = (masterByNumber.get(number) ?? [])[0]
  if (!master || !isReliableIdentityDocument(master.document)) return []
  return customersByDocument.get(documentDigits(master.document)) ?? []
}

function bucket(row) {
  const hits = documentHitsFor(row.number)
  const free = hits.filter((customer) => !abnetNumberFromExternalCode(customer.external_customer_code))
  const taken = hits.filter((customer) => {
    const existing = abnetNumberFromExternalCode(customer.external_customer_code)
    return existing && existing !== row.number
  })
  if (taken.length > 0) return "dni_en_otro_numero"
  if (free.length === 1) return "dni_unico"
  if (free.length > 1) return "multiples"
  return "otro"
}

const cohort = unresolved.filter((row) => bucket(row) === "dni_unico")
const multipleRows = unresolved.filter((row) => bucket(row) === "multiples")
const conflictRows = unresolved.filter((row) => bucket(row) === "dni_en_otro_numero")
if (cohort.length !== 212 || multipleRows.length !== 28 || conflictRows.length !== 4) {
  console.log(JSON.stringify({
    ok: false,
    reason: "El universo no coincide con la reconciliación anterior.",
    cohort: cohort.length,
    multiples: multipleRows.length,
    conflicts: conflictRows.length,
    unresolved: unresolved.length,
  }, null, 2))
  process.exit(1)
}

function customerView(customer) {
  const customerTasks = tasksByCustomer.get(customer.id) ?? []
  const recent = customerTasks.filter(taskLooksRecent)
  const latest = [...customerTasks].sort((left, right) => String(right.start_date ?? right.created_at).localeCompare(String(left.start_date ?? left.created_at)))[0] ?? null
  return {
    id: customer.id,
    customerNumber: customer.customer_number,
    name: customer.name,
    dni: customer.dni,
    abnetNumber: abnetNumberFromExternalCode(customer.external_customer_code),
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    locality: customer.locality,
    services: (servicesByCustomer.get(customer.id) ?? []).map((service) => ({
      catalogCode: service.catalog_code,
      status: service.commercial_status,
      price: service.monthly_fee,
      technology: service.technology,
    })),
    connections: (connectionsByCustomer.get(customer.id) ?? []).map((connection) => ({
      type: connection.connection_type,
      notes: connection.notes,
      ip: connection.ip_address,
      status: connection.technical_status,
      catalogCode: connection.catalogCode,
    })),
    tasks: customerTasks.length,
    recentTasks: recent.map((task) => ({
      code: task.code,
      type: task.type,
      status: task.status,
      startDate: task.start_date,
      title: task.title,
    })),
    latestTask: latest ? { code: latest.code, type: latest.type, status: latest.status, startDate: latest.start_date, title: latest.title } : null,
  }
}

function analyze(row) {
  const master = (masterByNumber.get(row.number) ?? [])[0] ?? null
  const hits = documentHitsFor(row.number)
  const free = hits.filter((customer) => !abnetNumberFromExternalCode(customer.external_customer_code))
  const taken = hits.filter((customer) => {
    const existing = abnetNumberFromExternalCode(customer.external_customer_code)
    return existing && existing !== row.number
  })
  const billing = billingByNumber.get(row.number) ?? []
  const catalog = mapAbnetResidentialCatalog(row.tipo, row.plan)
  const candidate = free.length === 1 ? customerView(free[0]) : null
  const candidateTasks = free.length === 1 ? (tasksByCustomer.get(free[0].id) ?? []) : []
  const recentCompatibleOt = candidateTasks.some((task) => taskLooksRecent(task) && (taskSupportsTechnology(task, row.tipo) || fold(task.type).includes("instalacion")))
  const serviceSupportsPlan = Boolean(
    candidate && catalog && candidate.services.some((service) => service.catalogCode === catalog)
      && candidate.connections.some((connection) => !row.nodo || fold(connection.notes).includes(fold(row.nodo)))
  )
  const decision = classifyDniCase({
    candidates: free,
    takenNumbers: [...new Set(taken.map((customer) => abnetNumberFromExternalCode(customer.external_customer_code)))],
    abnetName: master?.name || row.name,
    master: master ?? { phone: null, email: null, address: null, city: null, province: null, document: null },
    recentCompatibleOt,
    serviceSupportsPlan,
  })
  return {
    abnetNumber: row.number,
    conexName: row.name,
    masterName: master?.name ?? null,
    document: master?.document ?? null,
    masterEmail: master?.email ?? null,
    masterPhone: master?.phone ?? null,
    masterAddress: master?.address ?? null,
    masterCity: master?.city ?? null,
    masterProvince: master?.province ?? null,
    masterLocality: master ? packAbnetLocality(master.city, master.province) : null,
    inMaster: Boolean(master),
    internet: { plan: row.plan, tipo: row.tipo, nodo: row.nodo, estado: row.estado, tv: row.tv, catalog },
    billing: billing.map((item) => ({ plan: item.plan, tipo: item.tipo, nodo: item.nodo, ip: item.ip, estado: item.estado })),
    billed: billing.length > 0,
    candidate,
    candidates: free.map(customerView),
    taken: taken.map(customerView),
    classification: decision.classification,
    conflicts: decision.conflicts,
    support: decision.support,
    relations: { name: decision.name, phone: decision.phone, email: decision.email, address: decision.address, locality: decision.locality },
    recentCompatibleOt,
    serviceSupportsPlan,
  }
}

const cases = cohort.map(analyze)
const counts = {}
for (const row of cases) counts[row.classification] = (counts[row.classification] ?? 0) + 1
const expected = ["MATCH_SEGURO", "MATCH_PROBABLE", "REVIEW_MULTIPLE_CUSTOMERS", "REVIEW_CONFLICT", "REVIEW_ONLY_DNI", "NO_MATCH"]
for (const key of expected) counts[key] = counts[key] ?? 0

function listRow(row) {
  return {
    abnetNumber: row.abnetNumber,
    classification: row.classification,
    customerNumber: row.candidate?.customerNumber ?? null,
    customerId: row.candidate?.id ?? null,
    abnetName: row.masterName || row.conexName,
    bespokeName: row.candidate?.name ?? null,
    dni: row.document,
    support: row.support,
    conflicts: row.conflicts,
    relations: row.relations,
    internet: row.internet,
    billed: row.billed,
    recentTasks: row.candidate?.recentTasks ?? [],
    services: row.candidate?.services?.length ?? 0,
    connections: row.candidate?.connections?.length ?? 0,
  }
}

const multipleNumbers = [...new Set(multipleRows.map((row) => row.number))]
const multipleCases = multipleNumbers.map((number) => {
  const sample = multipleRows.find((row) => row.number === number)
  const hits = documentHitsFor(number).filter((customer) => !abnetNumberFromExternalCode(customer.external_customer_code))
  return {
    abnetNumber: number,
    name: (masterByNumber.get(number) ?? [])[0]?.name ?? sample?.name,
    document: (masterByNumber.get(number) ?? [])[0]?.document ?? null,
    rows: multipleRows.filter((row) => row.number === number).length,
    classification: "REVIEW_MULTIPLE_CUSTOMERS",
    candidates: hits.map(customerView),
  }
})
const conflictCases = [...new Set(conflictRows.map((row) => row.number))].map((number) => {
  const sample = conflictRows.find((row) => row.number === number)
  const hits = documentHitsFor(number)
  return {
    abnetNumber: number,
    name: (masterByNumber.get(number) ?? [])[0]?.name ?? sample?.name,
    document: (masterByNumber.get(number) ?? [])[0]?.document ?? null,
    classification: "REVIEW_CONFLICT",
    candidates: hits.map(customerView),
    billing: (billingByNumber.get(number) ?? []).map((item) => item.plan),
  }
})

const after = {
  customers: await fetchAll(db, "customers", "id"),
  services: await fetchAll(db, "isp_services", "id"),
  connections: await fetchAll(db, "isp_connections", "id"),
  tasks: await fetchAll(db, "tasks", "id"),
}
const report = {
  readOnly: true,
  operations: ["select"],
  rules: {
    seguro: "DNI único, nombre igual o diferencia mínima, y al menos teléfono, email, domicilio o localidad coinciden, sin contradicción.",
    probable: "DNI único y nombre compatible, sin contradicción, pero sin un contacto que confirme. La OT reciente no alcanza para MATCH_SEGURO.",
    onlyDni: "El nombre no aporta una comparación útil y no hay otra contradicción.",
    noMatch: "El nombre no comparte tokens. No se busca otro candidato.",
    conflict: "Nombre parcial, contacto incompatible, localidad incompatible, o el DNI ya tiene otro N° ABNet.",
  },
  cohort: { rows: cases.length, numbers: new Set(cases.map((row) => row.abnetNumber)).size },
  counts,
  sum: Object.values(counts).reduce((total, value) => total + value, 0),
  seguro: cases.filter((row) => row.classification === "MATCH_SEGURO").map(listRow),
  probable: cases.filter((row) => row.classification === "MATCH_PROBABLE").map(listRow),
  review: cases.filter((row) => row.classification !== "MATCH_SEGURO" && row.classification !== "MATCH_PROBABLE").map(listRow),
  multiples: { rows: multipleRows.length, numbers: multipleCases.length, cases: multipleCases },
  numberConflicts: { rows: conflictRows.length, numbers: conflictCases.length, cases: conflictCases },
  unchanged: {
    customers: before.customers.length === after.customers.length && after.customers.length === 5835,
    services: before.services.length === after.services.length && after.services.length === 3998,
    connections: before.connections.length === after.connections.length && after.connections.length === 3998,
    tasks: before.tasks.length === after.tasks.length && after.tasks.length === 1427,
  },
}
console.log(JSON.stringify(report, null, 2))
if (report.sum !== 212 || Object.values(report.unchanged).some((value) => !value)) process.exit(1)
