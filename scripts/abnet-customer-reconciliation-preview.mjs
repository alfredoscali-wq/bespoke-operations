/**
 * Preview de solo lectura para reconciliar identidad y contacto de customers
 * ya vinculados a un N° ABNet. No ejecuta INSERT, UPDATE, DELETE ni UPSERT.
 *
 * Uso: npx tsx scripts/abnet-customer-reconciliation-preview.mjs
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
const CUSTOMER_COLUMNS = [
  "external_customer_code",
  "customer_number",
  "name",
  "dni",
  "email",
  "phone",
  "whatsapp",
  "address",
  "locality",
]
const ABSENT_COLUMNS = [
  "apellido",
  "nombre_completo",
  "document_type",
  "provincia",
  "codigo_postal",
]

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

function assertReadOnlyInvocation() {
  if (process.argv.some((arg) => ["--apply", "--write", "--execute"].includes(arg))) {
    throw new Error("Este preview no acepta escritura.")
  }
}

function readOnlyFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(`Preview de solo lectura: ${String(prop)} bloqueado en ${table}.`)
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

function reliablePhone(value) {
  const current = digits(value)
  return current.length >= 6 && !/^(\d)\1+$/.test(current)
}

function reliableEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim())
}

function sameFold(left, right) {
  return fold(left) === fold(right)
}

function classifyText(current, source) {
  const bespoke = clean(current)
  const master = clean(source)
  if (!bespoke && !master) return { kind: "SAME_VALUE", action: "NO_CHANGE" }
  if (!bespoke && master) return { kind: "MISSING_IN_BESPOKE", action: "UPDATE_CANDIDATE", proposed: master }
  if (bespoke && !master) return { kind: "BESPOKE_ONLY", action: "NO_CHANGE" }
  if (bespoke === master) return { kind: "SAME_VALUE", action: "NO_CHANGE" }
  if (sameFold(bespoke, master)) return { kind: "FORMAT_DIFFERENCE", action: "NO_CHANGE" }
  return { kind: "DIFFERENT_VALUE", action: "REVIEW" }
}

function classifyPhone(current, source) {
  const bespoke = clean(current)
  const master = clean(source)
  if (!bespoke && !master) return { kind: "SAME_VALUE", action: "NO_CHANGE" }
  if (!bespoke && master) {
    if (!reliablePhone(master)) {
      return { kind: "MISSING_IN_BESPOKE", action: "REVIEW", reason: "Teléfono del maestro no confiable" }
    }
    return { kind: "MISSING_IN_BESPOKE", action: "UPDATE_CANDIDATE", proposed: master }
  }
  if (bespoke && !master) return { kind: "BESPOKE_ONLY", action: "NO_CHANGE" }
  const left = comparablePhone(bespoke)
  const right = comparablePhone(master)
  if (left.length >= 6 && left === right) {
    return bespoke === master
      ? { kind: "SAME_VALUE", action: "NO_CHANGE" }
      : { kind: "FORMAT_DIFFERENCE", action: "NO_CHANGE" }
  }
  return { kind: "DIFFERENT_VALUE", action: "REVIEW" }
}

function classifyEmail(current, source) {
  const bespoke = clean(current)
  const master = clean(source)
  if (!bespoke && !master) return { kind: "SAME_VALUE", action: "NO_CHANGE" }
  if (!bespoke && master) {
    if (!reliableEmail(master)) {
      return { kind: "MISSING_IN_BESPOKE", action: "REVIEW", reason: "Email del maestro no confiable" }
    }
    return { kind: "MISSING_IN_BESPOKE", action: "UPDATE_CANDIDATE", proposed: master }
  }
  if (bespoke && !master) return { kind: "BESPOKE_ONLY", action: "NO_CHANGE" }
  if (bespoke.toLowerCase() === master.toLowerCase()) {
    return bespoke === master
      ? { kind: "SAME_VALUE", action: "NO_CHANGE" }
      : { kind: "FORMAT_DIFFERENCE", action: "NO_CHANGE" }
  }
  return { kind: "DIFFERENT_VALUE", action: "REVIEW" }
}

function classifyDocument(current, source) {
  const bespoke = clean(current)
  const master = clean(source)
  if (!bespoke && !master) return { kind: "SAME_VALUE", action: "NO_CHANGE" }
  if (!bespoke && master) {
    if (!isReliableIdentityDocument(master)) {
      return { kind: "MISSING_IN_BESPOKE", action: "REVIEW", reason: "Documento del maestro no confiable" }
    }
    return { kind: "MISSING_IN_BESPOKE", action: "UPDATE_CANDIDATE", proposed: master }
  }
  if (bespoke && !master) return { kind: "BESPOKE_ONLY", action: "NO_CHANGE" }
  if (documentDigits(bespoke) === documentDigits(master) && documentDigits(bespoke).length > 0) {
    return bespoke === master
      ? { kind: "SAME_VALUE", action: "NO_CHANGE" }
      : { kind: "FORMAT_DIFFERENCE", action: "NO_CHANGE" }
  }
  return { kind: "DOCUMENT_CONFLICT", action: "REVIEW" }
}

function classifyName(current, source) {
  const bespoke = clean(current)
  const master = clean(source)
  if (!bespoke && !master) return { kind: "SAME_VALUE", action: "NO_CHANGE" }
  if (!bespoke && master) return { kind: "MISSING_IN_BESPOKE", action: "UPDATE_CANDIDATE", proposed: master }
  if (bespoke && !master) return { kind: "BESPOKE_ONLY", action: "NO_CHANGE" }
  if (bespoke === master) return { kind: "SAME_VALUE", action: "NO_CHANGE" }
  if (sameFold(bespoke, master)) return { kind: "FORMAT_DIFFERENCE", action: "NO_CHANGE" }
  return { kind: "NAME_CONFLICT", action: "REVIEW" }
}

function readBilling(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos") ? "Datos" : workbook.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true })
  return matrix.slice(1).flatMap((row) => {
    const number = abnetNumberFromExternalCode(row[0] == null ? null : String(row[0]).trim())
    if (!number) return []
    const text = (value) => {
      if (value == null) return null
      const current = String(value).trim()
      return current.length > 0 ? current : null
    }
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

function masterHeaders(file) {
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos") ? "Datos" : workbook.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true })
  return (matrix[0] ?? []).map((cell) => (cell == null ? null : String(cell)))
}

function customerBrief(row) {
  return {
    id: row.id,
    customerNumber: row.customer_number,
    name: row.name,
    dni: row.dni,
    externalCustomerCode: row.external_customer_code,
  }
}

assertReadOnlyInvocation()

const masterRows = readAbnetMasterRows(MASTER_PATH)
const billingRows = readBilling(DEFAULT_BILLING)
const internetRows = readInternetRows(DEFAULT_CONEX)
const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const db = { from: readOnlyFrom(client) }

const before = {
  customers: await fetchAll(db, "customers", "id, updated_at"),
  services: await fetchAll(db, "isp_services", "id"),
  connections: await fetchAll(db, "isp_connections", "id"),
  tasks: await fetchAll(db, "tasks", "id"),
}
const customers = await fetchAll(
  db,
  "customers",
  "id, customer_number, name, dni, email, phone, whatsapp, address, locality, external_customer_code, status, created_at, updated_at, deleted_at"
)
const subscribers = await fetchAll(db, "isp_subscribers", "id, customer_id, deleted_at")
const liveCustomers = customers.filter((row) => !row.deleted_at)
const subscriberIds = new Set(subscribers.filter((row) => !row.deleted_at).map((row) => row.customer_id))

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
const customersByName = new Map()
for (const row of liveCustomers) {
  const number = abnetNumberFromExternalCode(row.external_customer_code)
  if (number) {
    const current = customersByNumber.get(number) ?? []
    current.push(row)
    customersByNumber.set(number, current)
  }
  const document = documentDigits(row.dni)
  if (isReliableIdentityDocument(row.dni)) {
    const current = customersByDocument.get(document) ?? []
    current.push(row)
    customersByDocument.set(document, current)
  }
  const name = fold(row.name)
  if (name) {
    const current = customersByName.get(name) ?? []
    current.push(row)
    customersByName.set(name, current)
  }
}
const billingByNumber = new Map()
for (const row of billingRows) {
  const current = billingByNumber.get(row.number) ?? []
  current.push(row)
  billingByNumber.set(row.number, current)
}

const duplicateNumbers = [...customersByNumber.entries()].filter(([, rows]) => rows.length > 1)
const comparisons = []
const conflicts = []
const formatDifferences = []
const updateCandidates = []
const blockedMissing = []
const withheld = []

for (const [number, group] of customersByNumber) {
  const masterGroup = masterByNumber.get(number) ?? []
  const billing = billingByNumber.get(number) ?? []
  if (group.length > 1) {
    conflicts.push({
      type: "DUPLICATE_ABNET_NUMBER",
      abnetNumber: number,
      customers: group.map(customerBrief),
      masterNames: masterGroup.map((row) => row.name),
      billingNames: [...new Set(billing.map((row) => row.name))],
    })
    continue
  }
  const customer = group[0]
  if (masterGroup.length === 0) continue
  if (masterGroup.length > 1) {
    conflicts.push({
      type: "AMBIGUOUS",
      abnetNumber: number,
      customer: customerBrief(customer),
      masterRows: masterGroup.map((row) => ({ name: row.name, document: row.document, phone: row.phone })),
    })
    continue
  }

  const master = masterGroup[0]
  const locality = packAbnetLocality(master.city, master.province)
  const fields = {
    name: classifyName(customer.name, master.name),
    dni: classifyDocument(customer.dni, master.document),
    email: classifyEmail(customer.email, master.email),
    phone: classifyPhone(customer.phone, master.phone),
    address: classifyText(customer.address, master.address),
    locality: classifyText(customer.locality, locality),
  }
  const identityConflict = fields.name.kind === "NAME_CONFLICT" || fields.dni.kind === "DOCUMENT_CONFLICT"
  const record = {
    abnetNumber: number,
    customerId: customer.id,
    customerNumber: customer.customer_number,
    subscriber: subscriberIds.has(customer.id),
    fields,
    identityConflict,
    billing: {
      present: billing.length > 0,
      names: [...new Set(billing.map((row) => row.name))],
      plans: [...new Set(billing.map((row) => row.plan).filter(Boolean))],
      nodos: [...new Set(billing.map((row) => row.nodo).filter(Boolean))],
      ips: [...new Set(billing.map((row) => row.ip).filter(Boolean))],
      nameDisagreement: billing.some((row) => row.name && !sameFold(row.name, customer.name)),
    },
  }
  comparisons.push(record)

  for (const [field, result] of Object.entries(fields)) {
    const current = {
      name: customer.name,
      dni: customer.dni,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      locality: customer.locality,
    }[field]
    const source = {
      name: master.name,
      dni: master.document,
      email: master.email,
      phone: master.phone,
      address: master.address,
      locality,
    }[field]
    let outcome = result
    if (field === "locality" && outcome.action === "UPDATE_CANDIDATE" && /[ÃÂ]/.test(outcome.proposed ?? "")) {
      outcome = {
        kind: "MISSING_IN_BESPOKE",
        action: "REVIEW",
        reason: "Localidad del maestro con codificación dañada",
      }
    }
    if (field === "locality" && outcome.kind === "DIFFERENT_VALUE") {
      const city = clean(source)?.split(" · ")[0]
      if (city && sameFold(current, city) && String(source).includes(" · ")) {
        outcome = {
          ...outcome,
          reason: "La localidad ya tiene ciudad. El maestro agrega provincia y no se reemplaza.",
        }
      }
    }
    if (outcome.kind === "FORMAT_DIFFERENCE") {
      formatDifferences.push({
        abnetNumber: number,
        customerNumber: customer.customer_number,
        field,
        current,
        master: source,
      })
    }
    if (outcome.kind === "DOCUMENT_CONFLICT" || outcome.kind === "NAME_CONFLICT" || (outcome.action === "REVIEW" && outcome.kind === "DIFFERENT_VALUE")) {
      conflicts.push({
        type: outcome.kind === "DIFFERENT_VALUE" ? `${field.toUpperCase()}_CONFLICT` : outcome.kind,
        abnetNumber: number,
        customerId: customer.id,
        customerNumber: customer.customer_number,
        field,
        current,
        master: source,
        reason: outcome.reason ?? null,
        currentName: customer.name,
        masterName: master.name,
      })
    }
    if (outcome.action === "REVIEW" && outcome.kind === "MISSING_IN_BESPOKE") {
      withheld.push({
        abnetNumber: number,
        customerNumber: customer.customer_number,
        field,
        master: source,
        reason: outcome.reason,
      })
    }
    if (outcome.action === "UPDATE_CANDIDATE") {
      const candidate = {
        customerId: customer.id,
        customerNumber: customer.customer_number,
        abnetNumber: number,
        field,
        from: null,
        to: outcome.proposed,
        source: "Maestro ABNet",
        confidence: "HIGH",
      }
      if (identityConflict) blockedMissing.push({ ...candidate, blocked: "conflicto de identidad" })
      else updateCandidates.push(candidate)
    }
  }
}

const residential = collapseExactInternetCopies(
  internetRows.filter((row) => isInternetAccessType(row.tipo) && mapAbnetResidentialCatalog(row.tipo, row.plan))
)
const unresolved = residential.kept.filter((row) => (customersByNumber.get(row.number) ?? []).length === 0)
function identityBucket(row) {
  const master = (masterByNumber.get(row.number) ?? [])[0]
  const document = documentDigits(master?.document)
  const documentHits = isReliableIdentityDocument(master?.document) ? customersByDocument.get(document) ?? [] : []
  const freeDocuments = documentHits.filter((customer) => !abnetNumberFromExternalCode(customer.external_customer_code))
  const takenDocuments = documentHits.filter((customer) => {
    const existing = abnetNumberFromExternalCode(customer.external_customer_code)
    return existing && existing !== row.number
  })
  const nameHits = (customersByName.get(fold(row.name)) ?? []).filter(
    (customer) => !abnetNumberFromExternalCode(customer.external_customer_code)
  )
  if (takenDocuments.length > 0) return "dni_en_otro_numero"
  if (freeDocuments.length === 1) return "dni_unico"
  if (freeDocuments.length > 1) return "multiples"
  if (nameHits.length === 1) return "solo_nombre"
  if (nameHits.length > 1) return "multiples"
  return "sin_candidato"
}
const unresolvedBuckets = unresolved.reduce((map, row) => {
  const bucket = identityBucket(row)
  map.set(bucket, (map.get(bucket) ?? 0) + 1)
  return map
}, new Map())
const unresolvedCustomers = new Map()
for (const row of unresolved) {
  const bucket = identityBucket(row)
  const current = unresolvedCustomers.get(row.number) ?? { number: row.number, name: row.name, bucket, rows: 0 }
  current.rows += 1
  unresolvedCustomers.set(row.number, current)
}
const unresolvedCustomerBuckets = [...unresolvedCustomers.values()].reduce((map, row) => {
  map.set(row.bucket, (map.get(row.bucket) ?? 0) + 1)
  return map
}, new Map())

const withoutNumber = liveCustomers.filter((row) => !abnetNumberFromExternalCode(row.external_customer_code))
const withNumber = liveCustomers.length - withoutNumber.length
const noMasterCandidate = [...customersByNumber.keys()].filter((number) => !masterByNumber.has(number))
const fieldLabels = {
  email: "Email",
  phone: "Teléfono",
  address: "Domicilio",
  locality: "Localidad",
  dni: "DNI/CUIT",
  name: "Nombre",
}
const candidatesByField = {}
for (const label of Object.values(fieldLabels)) candidatesByField[label] = 0
candidatesByField.Provincia = updateCandidates.filter((row) => {
  if (row.field !== "locality") return false
  const master = masterByNumber.get(row.abnetNumber)?.[0]
  return Boolean(master?.province?.trim())
}).length
for (const row of updateCandidates) {
  const label = fieldLabels[row.field]
  if (label) candidatesByField[label] += 1
}

const comparedNumbers = new Set(comparisons.map((row) => row.abnetNumber))
const billingOfCompared = comparisons.filter((row) => row.billing.present)
const billingNameDisagreements = comparisons.filter((row) => row.billing.nameDisagreement)
const customersWithMissing = new Set(updateCandidates.map((row) => row.customerId))
const customersWithDifference = new Set([
  ...formatDifferences.map((row) => row.customerNumber),
  ...conflicts.filter((row) => row.customerNumber).map((row) => row.customerNumber),
])

const report = {
  readOnly: true,
  operations: ["select"],
  excelWrite: false,
  schema: {
    present: CUSTOMER_COLUMNS,
    absent: ABSENT_COLUMNS,
    localityPack: "ciudad · provincia cuando localidad está vacía",
    whatsapp: "Existe en customers. El maestro no tiene un teléfono distinto para WhatsApp, así que no se propone copiarlo.",
    masterHeaders: masterHeaders(MASTER_PATH),
  },
  summary: {
    customersAnalyzed: liveCustomers.length,
    subscribers: subscriberIds.size,
    withAbnetNumber: withNumber,
    withoutAbnetNumber: withoutNumber.length,
    exactMatches: comparisons.length,
    duplicateAbnetNumbers: duplicateNumbers.length,
    customersWithMissingData: customersWithMissing.size,
    customersWithDifferences: customersWithDifference.size,
    customersWithConflicts: new Set(conflicts.map((row) => row.abnetNumber)).size,
    customersWithoutMasterCandidate: noMasterCandidate.length,
    updateCandidates: updateCandidates.length,
    blockedByIdentityConflict: blockedMissing.length,
    formatDifferences: formatDifferences.length,
    withheldUnreliable: withheld.length,
  },
  formatByField: formatDifferences.reduce((map, row) => {
    map[row.field] = (map[row.field] ?? 0) + 1
    return map
  }, {}),
  conflictByType: {},
  candidatesByField,
  updateCandidates,
  blockedMissing,
  withheld,
  conflicts,
  formatDifferenceSamples: formatDifferences.slice(0, 12),
  withoutAbnetNumber: {
    total: withoutNumber.length,
    proposedNumberAssignments: 0,
    sample: withoutNumber.slice(0, 12).map((row) => ({
      customerNumber: row.customer_number,
      name: row.name,
      dni: row.dni,
      createdAt: row.created_at,
      subscriber: subscriberIds.has(row.id),
    })),
  },
  unresolvedResidential: {
    rows: unresolved.length,
    customers: unresolvedCustomers.size,
    rowsByBucket: Object.fromEntries(unresolvedBuckets),
    customersByBucket: Object.fromEntries(unresolvedCustomerBuckets),
    modifications: 0,
  },
  billing: {
    comparedCustomers: comparisons.length,
    billed: billingOfCompared.length,
    notBilled: comparisons.length - billingOfCompared.length,
    nameDisagreements: billingNameDisagreements.length,
    nameDisagreementSamples: billingNameDisagreements.slice(0, 8).map((row) => ({
      abnetNumber: row.abnetNumber,
      customerName: comparisons.find((item) => item.abnetNumber === row.abnetNumber)?.fields ? undefined : undefined,
      billingNames: row.billing.names,
      customerNumber: row.customerNumber,
    })),
    absenceIsNotBaja: true,
  },
  duplicateAbnetNumbers: duplicateNumbers.map(([number, rows]) => ({
    abnetNumber: number,
    customers: rows.map(customerBrief),
  })),
}

const customerByAbnet = new Map(comparisons.map((row) => [row.abnetNumber, row]))
report.conflictByType = conflicts.reduce((map, row) => {
  map[row.type] = (map[row.type] ?? 0) + 1
  return map
}, {})
report.billing.nameDisagreementSamples = billingNameDisagreements.slice(0, 8).map((row) => {
  const master = masterByNumber.get(row.abnetNumber)?.[0]
  return {
    abnetNumber: row.abnetNumber,
    customerNumber: row.customerNumber,
    bespokeName: customerByAbnet.get(row.abnetNumber) ? liveCustomers.find((item) => item.customer_number === row.customerNumber)?.name ?? null : null,
    masterName: master?.name ?? null,
    billingNames: row.billing.names,
    plans: row.billing.plans,
    nodos: row.billing.nodos,
  }
})

const after = {
  customers: await fetchAll(db, "customers", "id, updated_at"),
  services: await fetchAll(db, "isp_services", "id"),
  connections: await fetchAll(db, "isp_connections", "id"),
  tasks: await fetchAll(db, "tasks", "id"),
}
const maxUpdated = (rows) => rows.reduce((max, row) => (row.updated_at > max ? row.updated_at : max), "")
report.unchanged = {
  customers: before.customers.length === after.customers.length && maxUpdated(before.customers) === maxUpdated(after.customers),
  services: before.services.length === after.services.length,
  connections: before.connections.length === after.connections.length,
  tasks: before.tasks.length === after.tasks.length,
}
report.counts = {
  services: after.services.length,
  connections: after.connections.length,
  customers: after.customers.length,
  tasks: after.tasks.length,
}

console.log(JSON.stringify(report, null, 2))
if (Object.values(report.unchanged).some((value) => !value)) process.exit(1)
