/**
 * Aplica solo los 8 cambios de contacto aprobados del preview ABNet.
 * No toca localidad, conflictos, números ABNet ni otras tablas.
 *
 * Uso: npx tsx scripts/apply-abnet-customer-reconciliation.mjs
 */
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

import { abnetNumberFromExternalCode, documentDigits } from "../lib/isp/abnet-master-universe.ts"
import { fold } from "../lib/isp/abnet-residential-load.ts"
import { readAbnetMasterRows } from "./abnet-master-workbook.mjs"
import {
  ABNET_COMPANY_ID,
  fetchAll,
  loadEnv,
} from "./abnet-residential-sources.mjs"

const MASTER_PATH = "C:\\Users\\alfre\\Downloads\\BASE CLIENTES.xlsx"
const COLUMNS = {
  phone: "phone",
  dni: "dni",
  email: "email",
  address: "address",
}

/**
 * Los 8 UPDATE_CANDIDATE de teléfono, DNI, email y domicilio.
 * Las 7 localidades "Córdoba" no están en esta lista.
 */
export const APPROVED_CONTACT_UPDATES = [
  {
    customerId: "9915e8b5-e038-4592-97c3-fc204fe8d114",
    customerNumber: "CLI-005802",
    abnetNumber: "6547",
    field: "dni",
    value: "42696705",
  },
  {
    customerId: "9915e8b5-e038-4592-97c3-fc204fe8d114",
    customerNumber: "CLI-005802",
    abnetNumber: "6547",
    field: "email",
    value: "axeldomin420@gmail.com",
  },
  {
    customerId: "9915e8b5-e038-4592-97c3-fc204fe8d114",
    customerNumber: "CLI-005802",
    abnetNumber: "6547",
    field: "phone",
    value: "+5493572605849",
  },
  {
    customerId: "9915e8b5-e038-4592-97c3-fc204fe8d114",
    customerNumber: "CLI-005802",
    abnetNumber: "6547",
    field: "address",
    value: "Irigoyen s/n",
  },
  {
    customerId: "00bf4166-9d0f-4712-a461-846ca7bcd0a7",
    customerNumber: "CLI-005303",
    abnetNumber: "6511",
    field: "phone",
    value: "+5493572549059",
  },
  {
    customerId: "483bbd87-d734-4989-a0c6-a71c3283af74",
    customerNumber: "CLI-000879",
    abnetNumber: "1565",
    field: "phone",
    value: "+5493512811342",
  },
  {
    customerId: "99bb9aeb-400e-440e-8b2c-052992ae7084",
    customerNumber: "CLI-001652",
    abnetNumber: "2667",
    field: "phone",
    value: "3572526730",
  },
  {
    customerId: "ae4b5054-52c4-441d-bff3-c106c5bd56f9",
    customerNumber: "CLI-000466",
    abnetNumber: "881",
    field: "phone",
    value: "+54 9 3816 23-6830",
  },
]

export const UNTOUCHED_LOCALITY_CUSTOMERS = [
  "0c3f4cdf-e5f4-49a4-b56e-a303c40985ed",
  "1b92ad25-d47a-4b42-926a-0b3ef5adb82e",
  "381f8f06-4913-420a-a111-2cca68302abd",
  "51560396-7c2b-4656-b06f-297fa3ec97a5",
  "5de12f9f-3174-4e7c-9b4b-9cc84ab4b464",
  "844f03be-6f18-4c13-af04-8d0b71edeb9e",
  "ca67268d-d177-4c80-9cad-4d10f2a64bd5",
]

export function assertApprovedContactList(changes = APPROVED_CONTACT_UPDATES) {
  if (changes.length !== 8) throw new Error("La lista aprobada debe tener 8 cambios.")
  const counts = { phone: 0, dni: 0, email: 0, address: 0 }
  for (const change of changes) {
    if (!COLUMNS[change.field]) throw new Error(`Campo no aprobado: ${change.field}`)
    if (change.field === "locality" || change.value === "Córdoba") {
      throw new Error("La localidad no está aprobada.")
    }
    counts[change.field] += 1
  }
  if (counts.phone !== 5 || counts.dni !== 1 || counts.email !== 1 || counts.address !== 1) {
    throw new Error("La lista aprobada no coincide con 5 teléfonos, 1 DNI, 1 email y 1 domicilio.")
  }
}

function blank(value) {
  return value == null || String(value).trim() === ""
}

function clean(value) {
  return blank(value) ? null : String(value).trim()
}

function masterValue(master, field) {
  if (field === "dni") return master?.document ?? null
  return master?.[field] ?? null
}

export function decideApprovedUpdate(change, input) {
  const customer = input.customer
  const master = input.master
  if (!customer || customer.deleted_at) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "El customer ya no está disponible." }
  }
  if (customer.id !== change.customerId || customer.customer_number !== change.customerNumber) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "El customer_id no coincide." }
  }
  if (abnetNumberFromExternalCode(customer.external_customer_code) !== change.abnetNumber) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "El N° ABNet del customer cambió." }
  }
  if (input.customersWithSameNumber !== 1) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "El N° ABNet no tiene un único customer." }
  }
  if (!master) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "El maestro ya no tiene ese N° ABNet." }
  }
  if (clean(masterValue(master, change.field)) !== change.value) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "El valor del maestro ya no coincide con el preview." }
  }
  const column = COLUMNS[change.field]
  if (!blank(customer[column])) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "El campo ya no está vacío." }
  }
  if (fold(customer.name) !== fold(master.name)) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "Hay conflicto de nombre." }
  }
  if (!blank(customer.dni) && !blank(master.document) && documentDigits(customer.dni) !== documentDigits(master.document)) {
    return { action: "SKIPPED_STALE_PREVIEW", reason: "Hay conflicto de DNI." }
  }
  return { action: "APPLY" }
}

function guardedFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(`${String(prop)} está bloqueado.`)
          }
        }
        if (prop === "update") {
          return (values) => {
            const keys = Object.keys(values ?? {})
            if (table !== "customers" || keys.length !== 1 || !COLUMNS[keys[0]]) {
              throw new Error("Solo se puede actualizar teléfono, DNI, email o domicilio de customers.")
            }
            return target.update(values)
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
}

function fingerprint(rows, pick) {
  return rows
    .filter((row) => !row.deleted_at)
    .map(pick)
    .sort()
    .join("\n")
}

function numbersWithDuplicates(rows) {
  const counts = new Map()
  for (const row of rows) {
    if (row.deleted_at) continue
    const number = abnetNumberFromExternalCode(row.external_customer_code)
    if (!number) continue
    counts.set(number, (counts.get(number) ?? 0) + 1)
  }
  return [...counts.values()].filter((count) => count > 1).length
}

async function updateEmptyField(db, change) {
  const column = COLUMNS[change.field]
  const { data, error } = await db
    .from("customers")
    .update({ [column]: change.value })
    .eq("id", change.customerId)
    .eq("company_id", ABNET_COMPANY_ID)
    .is(column, null)
    .select("id")
  if (error) throw new Error(error.message)
  return (data ?? []).length === 1
}

async function main() {
  assertApprovedContactList()
  const masterRows = readAbnetMasterRows(MASTER_PATH)
  const masterByNumber = new Map()
  for (const row of masterRows) {
    const number = abnetNumberFromExternalCode(row.customerNumber)
    if (!number) continue
    const current = masterByNumber.get(number) ?? []
    current.push(row)
    masterByNumber.set(number, current)
  }

  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const db = { from: guardedFrom(client) }
  const customerColumns = "id, customer_number, name, dni, email, phone, address, locality, external_customer_code, deleted_at, updated_at"
  const beforeCustomers = await fetchAll(db, "customers", customerColumns)
  const beforeServices = await fetchAll(db, "isp_services", "id, updated_at")
  const beforeConnections = await fetchAll(db, "isp_connections", "id, updated_at")
  const beforeTasks = await fetchAll(db, "tasks", "id, updated_at")
  const liveBefore = beforeCustomers.filter((row) => !row.deleted_at)
  const byId = new Map(liveBefore.map((row) => [row.id, row]))
  const countByNumber = new Map()
  for (const row of liveBefore) {
    const number = abnetNumberFromExternalCode(row.external_customer_code)
    if (!number) continue
    countByNumber.set(number, (countByNumber.get(number) ?? 0) + 1)
  }
  const localityBefore = Object.fromEntries(
    UNTOUCHED_LOCALITY_CUSTOMERS.map((id) => [id, byId.get(id)?.locality ?? null])
  )

  const applied = []
  const skipped = []
  for (const change of APPROVED_CONTACT_UPDATES) {
    const masters = masterByNumber.get(change.abnetNumber) ?? []
    const decision = decideApprovedUpdate(change, {
      customer: byId.get(change.customerId) ?? null,
      master: masters.length === 1 ? masters[0] : null,
      customersWithSameNumber: countByNumber.get(change.abnetNumber) ?? 0,
    })
    if (decision.action !== "APPLY") {
      skipped.push({ ...change, reason: decision.reason })
      continue
    }
    const wrote = await updateEmptyField(db, change)
    if (!wrote) {
      skipped.push({ ...change, reason: "El campo dejó de estar vacío antes del UPDATE." })
      continue
    }
    const previous = byId.get(change.customerId)
    applied.push({
      customerNumber: change.customerNumber,
      abnetNumber: change.abnetNumber,
      field: change.field,
      before: null,
      after: change.value,
      source: "Maestro ABNet",
      customerId: change.customerId,
      name: previous?.name ?? null,
    })
  }

  const afterCustomers = await fetchAll(db, "customers", customerColumns)
  const afterServices = await fetchAll(db, "isp_services", "id, updated_at")
  const afterConnections = await fetchAll(db, "isp_connections", "id, updated_at")
  const afterTasks = await fetchAll(db, "tasks", "id, updated_at")
  const liveAfter = afterCustomers.filter((row) => !row.deleted_at)
  const afterById = new Map(liveAfter.map((row) => [row.id, row]))
  const localityUnchanged = UNTOUCHED_LOCALITY_CUSTOMERS.every(
    (id) => (afterById.get(id)?.locality ?? null) === localityBefore[id]
  )
  const externalCodesUnchanged = fingerprint(beforeCustomers, (row) => `${row.id}|${row.external_customer_code ?? ""}`)
    === fingerprint(afterCustomers, (row) => `${row.id}|${row.external_customer_code ?? ""}`)
  const maxUpdated = (rows) => rows.reduce((max, row) => ((row.updated_at ?? "") > max ? row.updated_at : max), "")
  const unchanged = {
    customerCount: liveBefore.length === liveAfter.length && liveAfter.length === 5835,
    customerIds: fingerprint(beforeCustomers, (row) => row.id) === fingerprint(afterCustomers, (row) => row.id),
    externalCodes: externalCodesUnchanged,
    services: beforeServices.length === afterServices.length && afterServices.length === 3998 && maxUpdated(beforeServices) === maxUpdated(afterServices),
    connections: beforeConnections.length === afterConnections.length && afterConnections.length === 3998 && maxUpdated(beforeConnections) === maxUpdated(afterConnections),
    tasks: beforeTasks.length === afterTasks.length && afterTasks.length === 1427 && maxUpdated(beforeTasks) === maxUpdated(afterTasks),
    locality: localityUnchanged,
    duplicateAbnetNumbers: numbersWithDuplicates(beforeCustomers) === 7 && numbersWithDuplicates(afterCustomers) === 7,
    withoutAbnetNumber: liveBefore.filter((row) => !abnetNumberFromExternalCode(row.external_customer_code)).length
      === liveAfter.filter((row) => !abnetNumberFromExternalCode(row.external_customer_code)).length,
  }
  const verified = applied.every((row) => {
    const current = afterById.get(row.customerId)
    return current && clean(current[COLUMNS[row.field]]) === row.after
  })
  const ok = Object.values(unchanged).every(Boolean) && verified && applied.length + skipped.length === 8
  const report = {
    applied: applied.length,
    skipped: skipped.length,
    changes: applied,
    skippedChanges: skipped,
    localityUpdates: 0,
    unchanged,
    counts: {
      customers: liveAfter.length,
      services: afterServices.length,
      connections: afterConnections.length,
      tasks: afterTasks.length,
    },
  }
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
