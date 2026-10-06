/**
 * Verificación de solo lectura del universo Clientes 360 ABNet.
 * No inserta, actualiza ni borra.
 *
 * Uso:
 *   npx tsx scripts/verify-abnet-master-universe.mjs --file "C:\ruta\BASE CLIENTES.xlsx"
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import path from "node:path"

import {
  ABNET_MASTER_CUSTOMER_STATUS,
  abnetNumberFromExternalCode,
  documentDigits,
  isReliableIdentityDocument,
  normalizeCustomerName,
  planAbnetMasterRow,
  planClientes360Universe,
} from "../lib/isp/abnet-master-universe.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"
import { readAbnetMasterRows } from "./abnet-master-workbook.mjs"

const COMPANY_ID = BESPOKE_PRODUCTION_COMPANY_ID
const PAGE_SIZE = 1000

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

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function main() {
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
        "id, customer_number, external_customer_code, dni, name, status, created_at, deleted_at"
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
      .select("customer_id, created_at, updated_at")
      .eq("company_id", COMPANY_ID)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })
  const subscribers = await fetchAll(async (from, to) => {
    const { data, error } = await client
      .from("isp_subscribers")
      .select("customer_id, deleted_at")
      .eq("company_id", COMPANY_ID)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const activeCustomers = customers.filter((row) => !row.deleted_at)
  const existingAbnetNumbers = new Set()
  const customersByNumber = new Map()
  const existingDocumentDigits = new Set()
  const existingNames = new Set()
  for (const row of customers) {
    const abnetNumber = abnetNumberFromExternalCode(row.external_customer_code)
    if (abnetNumber) {
      existingAbnetNumbers.add(abnetNumber)
      const current = customersByNumber.get(abnetNumber) ?? []
      current.push(row)
      customersByNumber.set(abnetNumber, current)
    }
    if (isReliableIdentityDocument(row.dni)) {
      existingDocumentDigits.add(documentDigits(row.dni))
    }
    const normalizedName = normalizeCustomerName(row.name)
    if (normalizedName) existingNames.add(normalizedName)
  }

  const masterNumbers = new Set()
  let linkedNumbers = 0
  let review = 0
  let stillMissing = 0
  const newMasterCustomers = []

  for (const row of masterRows) {
    const normalized = abnetNumberFromExternalCode(row.customerNumber)
    if (normalized) masterNumbers.add(normalized)
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
    if (decision.action === "linked") linkedNumbers += 1
    else if (decision.action === "review") review += 1
    else stillMissing += 1
  }

  for (const row of activeCustomers) {
    const abnetNumber = abnetNumberFromExternalCode(row.external_customer_code)
    if (!abnetNumber || !masterNumbers.has(abnetNumber)) continue
    if (row.status === ABNET_MASTER_CUSTOMER_STATUS) newMasterCustomers.push(row)
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

  const activeSubscriberIds = new Set(
    subscribers.filter((row) => !row.deleted_at).map((row) => row.customer_id)
  )
  const missingMasterSubscribers = universe.masterCustomerIds.filter(
    (id) => !activeSubscriberIds.has(id)
  )
  const missingAltaSubscribers = universe.recentAltaCustomerIds.filter(
    (id) => !activeSubscriberIds.has(id)
  )
  const historicalInUniverse = universe.historicalCustomerIds.filter((id) =>
    activeSubscriberIds.has(id)
  )
  const notesInUniverse = universe.noteCustomerIds.filter((id) =>
    activeSubscriberIds.has(id)
  )
  const duplicateNumbers = [...customersByNumber.entries()].filter(
    ([number, rows]) => masterNumbers.has(number) && rows.length > 1
  )

  const services = await countRows(client, "isp_services")
  const connections = await countRows(client, "isp_connections")
  const taskCount = await countRows(client, "tasks")

  const report = {
    masterRows: masterRows.length,
    linkedNumbers,
    linkedCustomerRows: universe.masterCustomerIds.length,
    stillMissing,
    review,
    createdFromMaster: newMasterCustomers.length,
    recentAltas: universe.recentAltaCustomerIds.length,
    recentAltasInClientes360: universe.recentAltaCustomerIds.length - missingAltaSubscribers.length,
    notesKeptOut: universe.noteCustomerIds.length,
    historical: universe.historicalCustomerIds.length,
    duplicateAbnetNumbers: duplicateNumbers.length,
    subscribers: activeSubscriberIds.size,
    missingMasterSubscribers: missingMasterSubscribers.length,
    missingAltaSubscribers: missingAltaSubscribers.length,
    historicalInClientes360: historicalInUniverse.length,
    notesInClientes360: notesInUniverse.length,
    services,
    connections,
    tasks: taskCount,
  }

  const ok =
    report.masterRows === 4785 &&
    report.stillMissing === 0 &&
    report.linkedCustomerRows >= 4504 &&
    report.recentAltas > 0 &&
    report.missingMasterSubscribers === 0 &&
    report.missingAltaSubscribers === 0 &&
    report.historicalInClientes360 === 0 &&
    report.notesInClientes360 === 0 &&
    report.duplicateAbnetNumbers === 7 &&
    report.services === 0 &&
    report.connections === 0 &&
    report.createdFromMaster > 0

  console.log(JSON.stringify({ ok, ...report }, null, 2))
  if (!ok) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
