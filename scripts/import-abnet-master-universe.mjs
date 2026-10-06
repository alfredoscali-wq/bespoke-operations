/**
 * Incorpora el maestro ABNet a Clientes 360 y conserva las altas recientes.
 *
 * No modifica customers existentes, OTs, servicios ni conexiones.
 * No lee Conex. Internet + TV.
 *
 * Uso:
 *   npx tsx scripts/import-abnet-master-universe.mjs
 *   npx tsx scripts/import-abnet-master-universe.mjs --apply --file "C:\ruta\BASE CLIENTES.xlsx"
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  ABNET_MASTER_CUSTOMER_STATUS,
  abnetNumberFromExternalCode,
  documentDigits,
  isReliableIdentityDocument,
  nextCustomerNumbers,
  normalizeCustomerName,
  planAbnetMasterRow,
  planClientes360Universe,
} from "../lib/isp/abnet-master-universe.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"
import { readAbnetMasterRows } from "./abnet-master-workbook.mjs"

const COMPANY_ID = BESPOKE_PRODUCTION_COMPANY_ID
const PAGE_SIZE = 1000
const INSERT_CHUNK = 200

function loadEnv() {
  const env = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8")
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.")
  }
  return { url, key }
}

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

async function fetchAll(loadPage) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await loadPage(from, from + PAGE_SIZE - 1)
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function fingerprint(row) {
  return [
    row.id,
    row.customer_number,
    row.external_customer_code ?? "",
    row.dni ?? "",
    row.name,
    row.status,
    row.updated_at,
    row.deleted_at ?? "",
    row.created_at,
  ].join("\u001f")
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function latestTimestamp(client, table) {
  const { data, error } = await client
    .from(table)
    .select("updated_at")
    .eq("company_id", COMPANY_ID)
    .order("updated_at", { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0]?.updated_at ?? null
}

async function main() {
  const apply = process.argv.includes("--apply")
  const filePath =
    argValue("--file") ?? "C:\\Users\\alfre\\Downloads\\BASE CLIENTES.xlsx"
  const masterRows = readAbnetMasterRows(filePath)
  const { url, key } = loadEnv()
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const customers = await fetchAll(async (from, to) => {
    const { data, error } = await client
      .from("customers")
      .select(
        "id, customer_number, external_customer_code, dni, name, status, created_at, updated_at, deleted_at"
      )
      .eq("company_id", COMPANY_ID)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const tasks = await fetchAll(async (from, to) => {
    const { data, error } = await client
      .from("tasks")
      .select("id, customer_id, created_at, updated_at")
      .eq("company_id", COMPANY_ID)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const subscribers = await fetchAll(async (from, to) => {
    const { data, error } = await client
      .from("isp_subscribers")
      .select("id, customer_id, source, deleted_at")
      .eq("company_id", COMPANY_ID)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const before = {
    customers: customers.length,
    tasks: await countRows(client, "tasks"),
    taskUpdatedAt: await latestTimestamp(client, "tasks"),
    services: await countRows(client, "isp_services"),
    serviceUpdatedAt: await latestTimestamp(client, "isp_services"),
    connections: await countRows(client, "isp_connections"),
    connectionUpdatedAt: await latestTimestamp(client, "isp_connections"),
    fingerprints: new Map(customers.map((row) => [row.id, fingerprint(row)])),
  }

  const activeCustomers = customers.filter((row) => !row.deleted_at)
  const existingAbnetNumbers = new Set()
  const customersByAbnetNumber = new Map()
  const existingDocumentDigits = new Set()
  const existingNames = new Set()

  for (const row of customers) {
    const abnetNumber = abnetNumberFromExternalCode(row.external_customer_code)
    if (abnetNumber) {
      existingAbnetNumbers.add(abnetNumber)
      const current = customersByAbnetNumber.get(abnetNumber) ?? []
      current.push(row.id)
      customersByAbnetNumber.set(abnetNumber, current)
    }
    if (isReliableIdentityDocument(row.dni)) {
      existingDocumentDigits.add(documentDigits(row.dni))
    }
    const normalizedName = normalizeCustomerName(row.name)
    if (normalizedName) existingNames.add(normalizedName)
  }

  const masterNumbers = new Set()
  const seenMasterNumbers = new Set()
  const linked = []
  const create = []
  const review = []

  for (const row of masterRows) {
    const normalized = abnetNumberFromExternalCode(row.customerNumber)
    if (normalized) masterNumbers.add(normalized)
    if (normalized && seenMasterNumbers.has(normalized)) {
      review.push({
        customerNumber: normalized,
        name: row.name,
        reason: "N° Cliente repetido dentro del maestro",
      })
      continue
    }
    if (normalized) seenMasterNumbers.add(normalized)

    const decision = planAbnetMasterRow({
      customerNumber: row.customerNumber,
      name: row.name,
      document: row.document,
      city: row.city,
      province: row.province,
      existingAbnetNumbers,
      existingDocumentDigits,
      existingNames,
    })

    if (decision.action === "linked") {
      linked.push(normalized)
      continue
    }
    if (decision.action === "review") {
      review.push({
        customerNumber: normalized ?? row.customerNumber,
        name: row.name,
        reason: decision.reason,
      })
      continue
    }

    create.push({
      customerNumber: normalized,
      externalCode: decision.externalCode,
      name: row.name.trim(),
      dni: row.document,
      email: row.email,
      phone: row.phone,
      address: row.address,
      locality: decision.locality,
    })
  }

  const universe = planClientes360Universe({
    masterNumbers,
    customers: activeCustomers.map((row) => ({
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

  const duplicatesInMaster = [...customersByAbnetNumber.entries()]
    .filter(([number, ids]) => ids.length > 1 && masterNumbers.has(number))
    .map(([number, ids]) => ({ number, customers: ids.length }))

  const report = {
    mode: apply ? "apply" : "dry-run",
    file: path.basename(filePath),
    masterRows: masterRows.length,
    uniqueMasterNumbers: masterNumbers.size,
    linkedNumbers: new Set(linked).size,
    linkedCustomerRows: universe.masterCustomerIds.length,
    missing: create.length + review.length,
    create: create.length,
    createRows: create.map((row) => ({
      customerNumber: row.customerNumber,
      name: row.name,
    })),
    review: review.length,
    reviewRows: review,
    recentAltas: universe.recentAltaCustomerIds.length,
    notesKeptOut: universe.noteCustomerIds.length,
    recentWindow: universe.recentAltaCustomerIds.length + universe.noteCustomerIds.length,
    historical: universe.historicalCustomerIds.length,
    duplicateAbnetNumbers: duplicatesInMaster,
    subscribersBefore: subscribers.filter((row) => !row.deleted_at).length,
    servicesBefore: before.services,
    connectionsBefore: before.connections,
    tasksBefore: before.tasks,
  }

  const auditMatches =
    report.masterRows === 4785 &&
    report.uniqueMasterNumbers === 4785 &&
    report.linkedNumbers === 4497 &&
    report.linkedCustomerRows === 4504 &&
    report.missing === 288 &&
    report.duplicateAbnetNumbers.length === 7

  report.auditMatches = auditMatches

  if (!apply) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (create.length > 0 && !auditMatches && !process.argv.includes("--force")) {
    console.log(JSON.stringify(report, null, 2))
    throw new Error(
      "Los conteos no coinciden con la auditoría. No se escribió nada."
    )
  }

  const customerNumbers = nextCustomerNumbers(
    customers.map((row) => row.customer_number),
    create.length
  )
  const customerPayload = create.map((row, index) => ({
    company_id: COMPANY_ID,
    customer_number: customerNumbers[index],
    name: row.name,
    external_customer_code: row.externalCode,
    dni: row.dni,
    email: row.email,
    phone: row.phone,
    address: row.address,
    locality: row.locality,
    status: ABNET_MASTER_CUSTOMER_STATUS,
  }))

  const created = []
  for (let index = 0; index < customerPayload.length; index += INSERT_CHUNK) {
    const chunk = customerPayload.slice(index, index + INSERT_CHUNK)
    const { data, error } = await client
      .from("customers")
      .insert(chunk)
      .select("id, customer_number, external_customer_code")
    if (error) throw new Error(error.message)
    created.push(...(data ?? []))
  }

  const subscriberByCustomer = new Map(
    subscribers.map((row) => [row.customer_id, row])
  )
  const recentIds = new Set(universe.recentAltaCustomerIds)
  const targetIds = [
    ...universe.masterCustomerIds,
    ...created.map((row) => row.id),
    ...universe.recentAltaCustomerIds,
  ]
  const subscriberPayload = []
  let subscribersSkipped = 0
  const subscribersDeletedLeft = []

  for (const customerId of new Set(targetIds)) {
    const current = subscriberByCustomer.get(customerId)
    if (!current) {
      subscriberPayload.push({
        company_id: COMPANY_ID,
        customer_id: customerId,
        source: recentIds.has(customerId) ? "onboarding" : "migration",
      })
      continue
    }
    if (current.deleted_at) subscribersDeletedLeft.push(customerId)
    else subscribersSkipped += 1
  }

  let subscribersCreated = 0
  for (let index = 0; index < subscriberPayload.length; index += INSERT_CHUNK) {
    const chunk = subscriberPayload.slice(index, index + INSERT_CHUNK)
    const { error } = await client.from("isp_subscribers").insert(chunk)
    if (error) throw new Error(error.message)
    subscribersCreated += chunk.length
  }

  const afterCustomers = await fetchAll(async (from, to) => {
    const { data, error } = await client
      .from("customers")
      .select(
        "id, customer_number, external_customer_code, dni, name, status, created_at, updated_at, deleted_at"
      )
      .eq("company_id", COMPANY_ID)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const changedExisting = []
  for (const [id, previous] of before.fingerprints) {
    const current = afterCustomers.find((row) => row.id === id)
    if (!current || fingerprint(current) !== previous) changedExisting.push(id)
  }

  const after = {
    tasks: await countRows(client, "tasks"),
    taskUpdatedAt: await latestTimestamp(client, "tasks"),
    services: await countRows(client, "isp_services"),
    serviceUpdatedAt: await latestTimestamp(client, "isp_services"),
    connections: await countRows(client, "isp_connections"),
    connectionUpdatedAt: await latestTimestamp(client, "isp_connections"),
  }

  const integrity = {
    existingCustomersUnchanged: changedExisting.length === 0,
    changedExistingCustomers: changedExisting.length,
    tasksUnchanged: after.tasks === before.tasks && after.taskUpdatedAt === before.taskUpdatedAt,
    servicesUnchanged:
      after.services === before.services &&
      after.serviceUpdatedAt === before.serviceUpdatedAt,
    connectionsUnchanged:
      after.connections === before.connections &&
      after.connectionUpdatedAt === before.connectionUpdatedAt,
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        createdCustomers: created.length,
        createdCustomerNumbers: created.map((row) => row.customer_number),
        subscribersCreated,
        subscribersSkipped,
        subscribersDeletedLeft: subscribersDeletedLeft.length,
        integrity,
        servicesAfter: after.services,
        connectionsAfter: after.connections,
        tasksAfter: after.tasks,
        customersAfter: afterCustomers.length,
      },
      null,
      2
    )
  )

  if (
    !integrity.existingCustomersUnchanged ||
    !integrity.tasksUnchanged ||
    !integrity.servicesUnchanged ||
    !integrity.connectionsUnchanged
  ) {
    throw new Error("La verificación de integridad posterior falló.")
  }
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
