/**
 * Diagnóstico de solo lectura del universo comercial de Clientes 360.
 * No escribe en Supabase ni asigna N° ABNet.
 *
 * Uso: npx tsx scripts/abnet-clientes-360-universe-audit.mjs
 */
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

import {
  ABNET_MASTER_RECENT_SINCE,
  abnetNumberFromExternalCode,
  documentDigits,
  isReliableIdentityDocument,
  planClientes360Universe,
} from "../lib/isp/abnet-master-universe.ts"
import { readAbnetMasterRows } from "./abnet-master-workbook.mjs"
import {
  ABNET_COMPANY_ID,
  DEFAULT_BILLING,
  fetchAll,
  loadEnv,
  readBillingRows,
} from "./abnet-residential-sources.mjs"

const MASTER_PATH = "C:\\Users\\alfre\\Downloads\\BASE CLIENTES.xlsx"
const EXPECTED_MASTER_NUMBERS = 4785
const KNOWN_DUPLICATE_NUMBERS = ["1390", "1708", "3029", "3058", "4676", "5032", "5437"]

export function blank(value) {
  return value == null || String(value).trim() === ""
}

export function taskIsRecent(task, since = ABNET_MASTER_RECENT_SINCE) {
  if (!task || task.deleted_at) return false
  return (task.created_at ?? "") >= since || (task.updated_at ?? "") >= since
}

function latestTask(tasks) {
  const live = tasks.filter((task) => !task.deleted_at)
  return live.reduce((latest, task) => {
    if (!latest) return task
    const left = task.created_at ?? ""
    const right = latest.created_at ?? ""
    return left > right ? task : latest
  }, null)
}

/**
 * Una categoría por customer.
 * La ventana es ABNET_MASTER_RECENT_SINCE. Una OT reciente usa created_at o
 * updated_at, igual que planClientes360Universe, y además exige que no esté borrada.
 */
export function classifyClientes360Customer(customer, input) {
  const number = abnetNumberFromExternalCode(customer.external_customer_code)
  const tasks = input.tasks ?? []
  const recent = tasks.filter((task) => taskIsRecent(task, input.since))
  const latest = latestTask(tasks)
  const createdRecent = (customer.created_at ?? "") >= (input.since ?? ABNET_MASTER_RECENT_SINCE)

  if (number && input.masterNumbers.has(number)) {
    return {
      category: "MAESTRO_ABNET",
      abnetNumber: number,
      reason: "El N° ABNet está en el maestro.",
      recentTask: recent[0] ?? null,
      latestTask: latest,
    }
  }

  if (!number && !blank(customer.external_customer_code)) {
    return {
      category: "REVIEW",
      abnetNumber: null,
      reason: "external_customer_code no es un N° ABNet numérico.",
      recentTask: recent[0] ?? null,
      latestTask: latest,
    }
  }

  if (!number && recent.length > 0) {
    const task = recent.reduce((current, item) => ((item.created_at ?? "") > (current.created_at ?? "") ? item : current))
    const byCreated = (task.created_at ?? "") >= (input.since ?? ABNET_MASTER_RECENT_SINCE)
    const byUpdated = (task.updated_at ?? "") >= (input.since ?? ABNET_MASTER_RECENT_SINCE)
    return {
      category: "ALTA_RECIENTE_OT",
      abnetNumber: null,
      reason: byCreated
        ? "Sin N° ABNet y con OT creada dentro de la ventana reciente."
        : "Sin N° ABNet y con OT actualizada dentro de la ventana reciente.",
      recentBy: byCreated && byUpdated ? "created_at+updated_at" : byCreated ? "created_at" : "updated_at",
      recentTask: task,
      latestTask: latest,
    }
  }

  if (!number && createdRecent) {
    return {
      category: "REVIEW",
      abnetNumber: null,
      reason: "Creado dentro de la ventana reciente, sin OT que justifique el alta.",
      recentTask: null,
      latestTask: latest,
    }
  }

  if (!number) {
    return {
      category: "HISTORICO_FUERA_MAESTRO",
      abnetNumber: null,
      reason: "Sin N° ABNet y sin OT reciente.",
      recentTask: null,
      latestTask: latest,
    }
  }

  return {
    category: "REVIEW",
    abnetNumber: number,
    reason: "Tiene un N° ABNet que no está en el maestro actual. No se asume baja.",
    recentTask: recent[0] ?? null,
    latestTask: latest,
  }
}

function assertFixtures() {
  const since = ABNET_MASTER_RECENT_SINCE
  const master = new Set(["4151"])
  const base = {
    id: "c1",
    created_at: "2026-06-01T00:00:00.000Z",
    external_customer_code: null,
  }
  const maestro = classifyClientes360Customer(
    { ...base, external_customer_code: "00004151" },
    { masterNumbers: master, tasks: [], since }
  )
  const alta = classifyClientes360Customer(base, {
    masterNumbers: master,
    since,
    tasks: [{ created_at: "2026-09-30T12:00:00.000Z", updated_at: "2026-09-30T12:00:00.000Z", deleted_at: null, code: "OT-1", status: "finalizada", start_date: "2026-09-30" }],
  })
  const historico = classifyClientes360Customer(
    { ...base, external_customer_code: "00009999" },
    { masterNumbers: master, tasks: [], since }
  )
  const sinOt = classifyClientes360Customer(
    { ...base, created_at: "2026-10-01T12:00:00.000Z" },
    { masterNumbers: master, tasks: [], since }
  )
  const borrada = classifyClientes360Customer(base, {
    masterNumbers: master,
    since,
    tasks: [{ created_at: "2026-09-30T12:00:00.000Z", updated_at: "2026-09-30T12:00:00.000Z", deleted_at: "2026-10-01T00:00:00.000Z" }],
  })
  if (maestro.category !== "MAESTRO_ABNET") throw new Error("Fixture maestro")
  if (alta.category !== "ALTA_RECIENTE_OT") throw new Error("Fixture alta")
  if (historico.category !== "REVIEW") throw new Error("Fixture número fuera del maestro")
  if (sinOt.category !== "REVIEW") throw new Error("Fixture sin OT")
  if (borrada.category !== "HISTORICO_FUERA_MAESTRO") throw new Error("Fixture OT borrada")
}

function guardedFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(String(prop) + " está bloqueado.")
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
}

function taskView(task) {
  if (!task) return null
  return {
    code: task.code ?? null,
    status: task.status ?? null,
    startDate: task.start_date ?? null,
    createdAt: task.created_at ?? null,
    updatedAt: task.updated_at ?? null,
    title: task.title ?? null,
  }
}

function coverage(customerIds, serviceCustomers, connectionCustomers) {
  let services = 0
  let connections = 0
  let both = 0
  let neither = 0
  for (const id of customerIds) {
    const hasService = serviceCustomers.has(id)
    const hasConnection = connectionCustomers.has(id)
    if (hasService) services += 1
    if (hasConnection) connections += 1
    if (hasService && hasConnection) both += 1
    if (!hasService && !hasConnection) neither += 1
  }
  return {
    customers: customerIds.length,
    withService: services,
    withConnection: connections,
    withBoth: both,
    withNeither: neither,
    withoutService: customerIds.length - services,
    withoutConnection: customerIds.length - connections,
  }
}

async function main() {
  assertFixtures()
  const masterRows = readAbnetMasterRows(MASTER_PATH)
  const masterNumbers = new Set()
  const masterByDocument = new Map()
  for (const row of masterRows) {
    const number = abnetNumberFromExternalCode(row.customerNumber)
    if (!number) continue
    masterNumbers.add(number)
    if (!isReliableIdentityDocument(row.document)) continue
    const digits = documentDigits(row.document)
    const current = masterByDocument.get(digits) ?? []
    current.push(number)
    masterByDocument.set(digits, current)
  }
  const billingNumbers = new Set(readBillingRows(DEFAULT_BILLING).map((row) => row.number))

  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const db = { from: guardedFrom(client) }
  const before = {
    customers: (await fetchAll(db, "customers", "id")).length,
    services: (await fetchAll(db, "isp_services", "id")).length,
    connections: (await fetchAll(db, "isp_connections", "id")).length,
    tasks: (await fetchAll(db, "tasks", "id")).length,
  }

  const customers = await fetchAll(
    db,
    "customers",
    "id, customer_number, name, dni, email, phone, address, locality, external_customer_code, created_at, deleted_at"
  )
  const tasks = await fetchAll(
    db,
    "tasks",
    "id, customer_id, code, status, title, start_date, created_at, updated_at, deleted_at"
  )
  const services = await fetchAll(db, "isp_services", "id, customer_id, deleted_at")
  const connections = await fetchAll(db, "isp_connections", "id, service_id, deleted_at")
  const subscribers = await fetchAll(db, "isp_subscribers", "id, customer_id, deleted_at")

  const liveCustomers = customers.filter((row) => !row.deleted_at)
  const tasksByCustomer = new Map()
  for (const task of tasks) {
    if (!task.customer_id) continue
    const current = tasksByCustomer.get(task.customer_id) ?? []
    current.push(task)
    tasksByCustomer.set(task.customer_id, current)
  }
  const serviceCustomers = new Set(services.filter((row) => !row.deleted_at).map((row) => row.customer_id))
  const serviceById = new Map(services.filter((row) => !row.deleted_at).map((row) => [row.id, row.customer_id]))
  const connectionCustomers = new Set()
  for (const connection of connections) {
    if (connection.deleted_at) continue
    const customerId = serviceById.get(connection.service_id)
    if (customerId) connectionCustomers.add(customerId)
  }
  const taskCount = new Map()
  for (const [customerId, rows] of tasksByCustomer) {
    taskCount.set(customerId, rows.filter((task) => !task.deleted_at).length)
  }

  const classified = liveCustomers.map((customer) => {
    const decision = classifyClientes360Customer(customer, {
      masterNumbers,
      tasks: tasksByCustomer.get(customer.id) ?? [],
    })
    return { customer, decision }
  })

  const groups = {
    MAESTRO_ABNET: [],
    ALTA_RECIENTE_OT: [],
    HISTORICO_FUERA_MAESTRO: [],
    REVIEW: [],
  }
  for (const row of classified) groups[row.decision.category].push(row)

  const maestroNumbers = new Map()
  for (const row of groups.MAESTRO_ABNET) {
    const number = row.decision.abnetNumber
    maestroNumbers.set(number, (maestroNumbers.get(number) ?? 0) + 1)
  }
  const duplicateNumbers = [...maestroNumbers.entries()]
    .filter((entry) => entry[1] > 1)
    .map(([number, customersWithNumber]) => ({ number, customers: customersWithNumber }))
    .sort((left, right) => left.number.localeCompare(right.number, "en"))

  const legacyPlan = planClientes360Universe({
    masterNumbers,
    customers: liveCustomers.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      document: row.dni,
      abnetNumber: abnetNumberFromExternalCode(row.external_customer_code),
    })),
    tasks: tasks.map((row) => ({
      customerId: row.customer_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  })

  const altas = groups.ALTA_RECIENTE_OT.map(({ customer, decision }) => {
    const digits = isReliableIdentityDocument(customer.dni) ? documentDigits(customer.dni) : null
    const masterHits = digits ? [...new Set(masterByDocument.get(digits) ?? [])] : []
    const knownNumber = masterHits.length === 1 ? masterHits[0] : null
    return {
      customerId: customer.id,
      customerNumber: customer.customer_number,
      name: customer.name,
      dni: customer.dni,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      locality: customer.locality,
      createdAt: customer.created_at,
      taskCount: taskCount.get(customer.id) ?? 0,
      recentTask: taskView(decision.recentTask),
      latestTask: taskView(decision.latestTask),
      reason: decision.reason,
      recentBy: decision.recentBy,
      services: serviceCustomers.has(customer.id),
      connections: connectionCustomers.has(customer.id),
      masterNumberByUniqueDni: knownNumber,
      masterDniCandidates: masterHits.length,
      inOctoberBilling: knownNumber ? billingNumbers.has(knownNumber) : false,
    }
  })

  const reviews = groups.REVIEW.map(({ customer, decision }) => ({
    customerId: customer.id,
    customerNumber: customer.customer_number,
    name: customer.name,
    dni: customer.dni,
    abnetNumber: decision.abnetNumber,
    createdAt: customer.created_at,
    taskCount: taskCount.get(customer.id) ?? 0,
    latestTask: taskView(decision.latestTask),
    reason: decision.reason,
    services: serviceCustomers.has(customer.id),
    connections: connectionCustomers.has(customer.id),
  }))

  const reviewReasons = {}
  for (const row of reviews) reviewReasons[row.reason] = (reviewReasons[row.reason] ?? 0) + 1

  const idsOf = (rows) => rows.map((row) => row.customer.id)
  const maestroIds = idsOf(groups.MAESTRO_ABNET)
  const altaIds = idsOf(groups.ALTA_RECIENTE_OT)
  const historicoIds = idsOf(groups.HISTORICO_FUERA_MAESTRO)
  const reviewIds = idsOf(groups.REVIEW)
  const universeIds = [...maestroIds, ...altaIds]
  const subscriberIds = new Set(subscribers.filter((row) => !row.deleted_at).map((row) => row.customer_id))
  const universeSet = new Set(universeIds)
  const historicoWithTasks = historicoIds.filter((id) => (taskCount.get(id) ?? 0) > 0).length

  const withoutNumber = liveCustomers.filter((row) => blank(row.external_customer_code)).length
  const outsideMaster = liveCustomers.filter((row) => {
    const number = abnetNumberFromExternalCode(row.external_customer_code)
    return number && !masterNumbers.has(number)
  }).length

  const after = {
    customers: (await fetchAll(db, "customers", "id")).length,
    services: (await fetchAll(db, "isp_services", "id")).length,
    connections: (await fetchAll(db, "isp_connections", "id")).length,
    tasks: (await fetchAll(db, "tasks", "id")).length,
  }

  const report = {
    readOnly: true,
    operations: ["select"],
    recentSince: ABNET_MASTER_RECENT_SINCE,
    recentRule: "OT no borrada con created_at o updated_at >= ABNET_MASTER_RECENT_SINCE, la misma ventana de planClientes360Universe.",
    master: {
      rows: masterRows.length,
      uniqueNumbers: masterNumbers.size,
      expectedUniqueNumbers: EXPECTED_MASTER_NUMBERS,
      matchesPreviousAudit: masterRows.length === EXPECTED_MASTER_NUMBERS && masterNumbers.size === EXPECTED_MASTER_NUMBERS,
    },
    customers: {
      total: liveCustomers.length,
      withMasterNumber: groups.MAESTRO_ABNET.length,
      uniqueMasterNumbersLinked: maestroNumbers.size,
      withoutNumber,
      numberOutsideMaster: outsideMaster,
    },
    counts: {
      MAESTRO_ABNET: groups.MAESTRO_ABNET.length,
      ALTA_RECIENTE_OT: groups.ALTA_RECIENTE_OT.length,
      HISTORICO_FUERA_MAESTRO: groups.HISTORICO_FUERA_MAESTRO.length,
      REVIEW: groups.REVIEW.length,
    },
    universe: groups.MAESTRO_ABNET.length + groups.ALTA_RECIENTE_OT.length,
    showInClientes360: {
      MAESTRO_ABNET: "SÍ",
      ALTA_RECIENTE_OT: "SÍ",
      HISTORICO_FUERA_MAESTRO: "NO",
      REVIEW: "NO",
    },
    duplicates: {
      numbers: duplicateNumbers,
      known: KNOWN_DUPLICATE_NUMBERS,
      knownRemain: KNOWN_DUPLICATE_NUMBERS.every((number) => duplicateNumbers.some((row) => row.number === number && row.customers > 1)),
      onlyKnown: duplicateNumbers.length === KNOWN_DUPLICATE_NUMBERS.length && KNOWN_DUPLICATE_NUMBERS.every((number) => duplicateNumbers.some((row) => row.number === number)),
    },
    legacyPlan: {
      master: legacyPlan.masterCustomerIds.length,
      recentAlta: legacyPlan.recentAltaCustomerIds.length,
      notes: legacyPlan.noteCustomerIds.length,
      historical: legacyPlan.historicalCustomerIds.length,
    },
    universeCoverage: coverage(universeIds, serviceCustomers, connectionCustomers),
    maestroCoverage: coverage(maestroIds, serviceCustomers, connectionCustomers),
    altaCoverage: coverage(altaIds, serviceCustomers, connectionCustomers),
    historicalOutside: {
      ...coverage(historicoIds, serviceCustomers, connectionCustomers),
      withTasks: historicoWithTasks,
    },
    reviewCoverage: coverage(reviewIds, serviceCustomers, connectionCustomers),
    reviewReasons,
    currentSubscribers: subscriberIds.size,
    subscribersInsideUniverse: [...subscriberIds].filter((id) => universeSet.has(id)).length,
    subscribersOutsideUniverse: [...subscriberIds].filter((id) => !universeSet.has(id)).length,
    subscribersOutsideByCategory: classified.reduce((counts, row) => {
      if (!subscriberIds.has(row.customer.id) || universeSet.has(row.customer.id)) return counts
      counts[row.decision.category] = (counts[row.decision.category] ?? 0) + 1
      return counts
    }, {}),
    masterNumbersWithoutCustomer: masterNumbers.size - maestroNumbers.size,
    universeWithoutSubscriber: universeIds.filter((id) => !subscriberIds.has(id)).length,
    altas,
    reviews,
    unchanged: {
      customers: before.customers === after.customers,
      services: before.services === after.services,
      connections: before.connections === after.connections,
      tasks: before.tasks === after.tasks,
    },
    rowCounts: { before, after },
  }

  const sum = Object.values(report.counts).reduce((total, value) => total + value, 0)
  const ok = report.master.matchesPreviousAudit
    && sum === liveCustomers.length
    && liveCustomers.length === 5835
    && Object.values(report.unchanged).every(Boolean)
    && after.services === 3998
    && after.connections === 3998
    && after.tasks === 1427
    && report.duplicates.knownRemain
  console.log(JSON.stringify(report, null, 2))
  if (!ok) process.exit(1)
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
