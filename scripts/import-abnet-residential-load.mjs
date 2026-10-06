/**
 * Carga idempotente de servicios y conexiones residenciales ABNet.
 *
 * Clave de copia exacta: N° Cliente + tipo + nodo + plan + estado + TV + FINAL.
 * Un plan, estado, tipo o nodo distinto no se fusiona.
 *
 * Uso:
 *   npx tsx scripts/import-abnet-residential-load.mjs
 *   npx tsx scripts/import-abnet-residential-load.mjs --apply
 */
import { createClient } from "@supabase/supabase-js"
import { fileURLToPath } from "node:url"
import path from "node:path"

import { abnetNumberFromExternalCode } from "../lib/isp/abnet-master-universe.ts"
import {
  ABNET_RESIDENTIAL_CATALOG,
  connectionNodeNote,
  planAbnetResidentialLoad,
  residentialAuditMatches,
  sourceStatusNote,
} from "../lib/isp/abnet-residential-load.ts"
import {
  ABNET_COMPANY_ID,
  DEFAULT_BILLING,
  DEFAULT_CONEX,
  fetchAll,
  loadEnv,
  readBillingRows,
  readInternetRows,
} from "./abnet-residential-sources.mjs"

const CASE_C_NUMBERS = ["1016", "1785", "3509", "158", "983"]
const UNLINKED_BILLING_NUMBERS = [
  "6800", "6801", "6802", "6803", "6804", "6808", "6809", "6810", "6811", "6812",
  "6813", "6814", "6815", "6816", "6817", "6818", "6819", "6820", "6822", "6823",
  "6824", "6825", "6826", "6827",
]
const INSERT_CHUNK = 150

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

function contractedSpeed(download, upload, unit) {
  const label = String(unit ?? "mbps").toLowerCase() === "mbps" ? "Mbps" : unit
  if (download != null && upload != null) return `${download}/${upload} ${label}`
  if (download != null) return `${download}/— ${label}`
  return null
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", ABNET_COMPANY_ID)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function latestTimestamp(client, table) {
  const { data, error } = await client
    .from(table)
    .select("updated_at")
    .eq("company_id", ABNET_COMPANY_ID)
    .order("updated_at", { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0]?.updated_at ?? null
}

function fingerprint(row) {
  return [
    row.id,
    row.external_customer_code ?? "",
    row.status,
    row.updated_at,
    row.deleted_at ?? "",
  ].join("\u001f")
}

async function main() {
  const apply = process.argv.includes("--apply")
  const internetRows = readInternetRows(argValue("--conex") ?? DEFAULT_CONEX)
  const billingRows = readBillingRows(argValue("--billing") ?? DEFAULT_BILLING)
  const { url, key } = loadEnv()
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const customers = await fetchAll(
    client,
    "customers",
    "id, customer_number, external_customer_code, status, updated_at, deleted_at"
  )
  const customersByNumber = new Map()
  for (const row of customers) {
    if (row.deleted_at) continue
    const number = abnetNumberFromExternalCode(row.external_customer_code)
    if (!number) continue
    const current = customersByNumber.get(number) ?? []
    current.push(row.id)
    customersByNumber.set(number, current)
  }

  const plan = planAbnetResidentialLoad({ internetRows, billingRows, customersByNumber })
  if (!residentialAuditMatches(plan)) {
    throw new Error("El preview no coincide con la auditoría. No se escribió nada.")
  }
  if (plan.loadRows.some((row) => !row.row.nodo)) {
    throw new Error("Hay una conexión residencial sin nodo. No se escribió nada.")
  }

  const { data: catalogRows, error: catalogError } = await client
    .from("isp_service_catalog")
    .select("id, code, name, technology, monthly_price, download_speed_mbps, upload_speed_mbps, speed_unit, billing_method")
    .eq("company_id", ABNET_COMPANY_ID)
    .is("deleted_at", null)
    .in("code", Object.keys(ABNET_RESIDENTIAL_CATALOG))
  if (catalogError) throw new Error(catalogError.message)
  const catalogByCode = new Map((catalogRows ?? []).map((row) => [row.code, row]))
  for (const code of Object.keys(ABNET_RESIDENTIAL_CATALOG)) {
    const catalog = catalogByCode.get(code)
    const expected = ABNET_RESIDENTIAL_CATALOG[code]
    if (!catalog || catalog.monthly_price == null) {
      throw new Error(`El catálogo ${code} no tiene precio.`)
    }
    if (catalog.technology !== expected.technology) {
      throw new Error(`El catálogo ${code} no coincide con la tecnología del plan.`)
    }
  }

  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      auditMatches: true,
      servicesToCreate: plan.loadRows.length,
      connectionsToCreate: plan.loadRows.length,
      excludedStatus: plan.excludedStatus,
      excludedNoCustomer: plan.excludedNoCustomer,
      excludedAmbiguousCustomer: plan.excludedAmbiguousCustomer,
    }, null, 2))
    return
  }

  const before = {
    customers: new Map(customers.map((row) => [row.id, fingerprint(row)])),
    tasks: await countRows(client, "tasks"),
    taskUpdatedAt: await latestTimestamp(client, "tasks"),
    services: await countRows(client, "isp_services"),
    connections: await countRows(client, "isp_connections"),
  }

  const existingServices = await fetchAll(client, "isp_services", "id, external_code, customer_id, catalog_code, commercial_status, deleted_at")
  const existingConnections = await fetchAll(client, "isp_connections", "id, external_code, service_id, deleted_at")
  const serviceByCode = new Map(
    existingServices.filter((row) => row.external_code && !row.deleted_at).map((row) => [row.external_code, row])
  )
  const connectionByCode = new Set(
    existingConnections.filter((row) => row.external_code && !row.deleted_at).map((row) => row.external_code)
  )

  const missingServices = plan.loadRows.filter((row) => !serviceByCode.has(row.serviceExternalCode))
  let servicesCreated = 0
  for (let index = 0; index < missingServices.length; index += INSERT_CHUNK) {
    const chunk = missingServices.slice(index, index + INSERT_CHUNK).map((row) => {
      const catalog = catalogByCode.get(row.catalogCode)
      return {
        company_id: ABNET_COMPANY_ID,
        customer_id: row.customerId,
        catalog_id: catalog.id,
        catalog_code: catalog.code,
        technology: catalog.technology,
        plan_name: catalog.name,
        contracted_speed: contractedSpeed(catalog.download_speed_mbps, catalog.upload_speed_mbps, catalog.speed_unit),
        download_speed: catalog.download_speed_mbps,
        upload_speed: catalog.upload_speed_mbps,
        speed_unit: catalog.speed_unit || "mbps",
        list_price: catalog.monthly_price,
        monthly_fee: catalog.monthly_price,
        activation_date: row.activationDate,
        commercial_status: row.commercialStatus,
        monthly_collection_method: catalog.billing_method === "siro" ? "siro" : "pending",
        notes: sourceStatusNote(row.sourceStatus),
        external_code: row.serviceExternalCode,
      }
    })
    const { data, error } = await client.from("isp_services").insert(chunk).select("id, external_code")
    if (error) throw new Error(error.message)
    for (const row of data ?? []) serviceByCode.set(row.external_code, row)
    servicesCreated += data?.length ?? 0
  }

  const missingConnections = plan.loadRows.filter((row) => !connectionByCode.has(row.connectionExternalCode))
  let connectionsCreated = 0
  for (let index = 0; index < missingConnections.length; index += INSERT_CHUNK) {
    const chunk = missingConnections.slice(index, index + INSERT_CHUNK).map((row) => {
      const service = serviceByCode.get(row.serviceExternalCode)
      if (!service?.id) throw new Error(`Falta el servicio ${row.serviceExternalCode}.`)
      return {
        company_id: ABNET_COMPANY_ID,
        service_id: service.id,
        connection_type: row.ip ? "static_ip" : "other",
        ip_address: row.ip,
        notes: connectionNodeNote(row.row.nodo),
        technical_status: "pending_provision",
        external_code: row.connectionExternalCode,
      }
    })
    const { error } = await client.from("isp_connections").insert(chunk)
    if (error) throw new Error(error.message)
    connectionsCreated += chunk.length
  }

  const afterCustomers = await fetchAll(
    client,
    "customers",
    "id, external_customer_code, status, updated_at, deleted_at"
  )
  const afterById = new Map(afterCustomers.map((row) => [row.id, row]))
  const changedCustomers = []
  for (const [id, previous] of before.customers) {
    const current = afterById.get(id)
    if (!current || fingerprint(current) !== previous) changedCustomers.push(id)
  }
  const tasks = await countRows(client, "tasks")
  const taskUpdatedAt = await latestTimestamp(client, "tasks")
  const services = await countRows(client, "isp_services")
  const connections = await countRows(client, "isp_connections")

  const linkedNumbers = new Set()
  for (const number of [...CASE_C_NUMBERS, ...UNLINKED_BILLING_NUMBERS]) {
    const ids = customersByNumber.get(number) ?? []
    if (CASE_C_NUMBERS.includes(number) && ids.length !== 1) linkedNumbers.add(number)
  }
  const inventedBillingNumbers = UNLINKED_BILLING_NUMBERS.filter((number) => customersByNumber.get(number)?.length)
  const caseCWithService = CASE_C_NUMBERS.filter((number) => {
    const id = customersByNumber.get(number)?.[0]
    return id && plan.loadRows.some((row) => row.customerId === id)
  })

  console.log(JSON.stringify({
    mode: "apply",
    servicesCreated,
    connectionsCreated,
    services,
    connections,
    servicesExpected: before.services + servicesCreated,
    connectionsExpected: before.connections + connectionsCreated,
    excludedStatus: plan.excludedStatus,
    excludedNoCustomer: plan.excludedNoCustomer,
    excludedAmbiguousCustomer: plan.excludedAmbiguousCustomer,
    withIp: plan.withIp,
    changedCustomers: changedCustomers.length,
    tasksUnchanged: tasks === before.tasks && taskUpdatedAt === before.taskUpdatedAt,
    customersUnchanged: changedCustomers.length === 0 && afterCustomers.length === customers.length,
    inventedBillingNumbers,
    caseCWithService,
  }, null, 2))

  if (
    changedCustomers.length > 0 ||
    tasks !== before.tasks ||
    taskUpdatedAt !== before.taskUpdatedAt ||
    services !== before.services + servicesCreated ||
    connections !== before.connections + connectionsCreated ||
    inventedBillingNumbers.length > 0 ||
    caseCWithService.length > 0
  ) {
    throw new Error("La verificación posterior a la carga falló.")
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
