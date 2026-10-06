/**
 * Verificación de solo lectura de la carga residencial ABNet.
 * Uso: npx tsx scripts/verify-abnet-residential-load.mjs
 */
import { createClient } from "@supabase/supabase-js"

import { ABNET_RESIDENTIAL_CATALOG } from "../lib/isp/abnet-residential-load.ts"
import { abnetNumberFromExternalCode } from "../lib/isp/abnet-master-universe.ts"
import {
  ABNET_COMPANY_ID,
  fetchAll,
  loadEnv,
} from "./abnet-residential-sources.mjs"

const CASE_C = ["1016", "1785", "3509", "158", "983"]
const BILLING_NEW = [
  "6800", "6801", "6802", "6803", "6804", "6808", "6809", "6810", "6811", "6812",
  "6813", "6814", "6815", "6816", "6817", "6818", "6819", "6820", "6822", "6823",
  "6824", "6825", "6826", "6827",
]
const PRICES = {
  "WIRELESS-20-TV-BASICO": 32800,
  "FTTH-50-TV-BASICO": 35300,
  "FTTH-100-TV-BASICO": 39300,
  "FTTH-300-TV-BASICO": 44300,
}

const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const services = await fetchAll(
  client,
  "isp_services",
  "id, customer_id, catalog_code, commercial_status, monthly_fee, list_price, technology, notes, external_code, deleted_at"
)
const connections = await fetchAll(
  client,
  "isp_connections",
  "id, service_id, connection_type, ip_address, notes, technical_status, external_code, deleted_at"
)
const customers = await fetchAll(
  client,
  "customers",
  "id, external_customer_code, deleted_at"
)

const liveServices = services.filter((row) => !row.deleted_at)
const liveConnections = connections.filter((row) => !row.deleted_at)
const byCode = {}
const byStatus = {}
const byTechnology = {}
let wrongPrice = 0
let outsideCatalog = 0
const perCustomer = new Map()
for (const row of liveServices) {
  byCode[row.catalog_code] = (byCode[row.catalog_code] ?? 0) + 1
  byStatus[row.commercial_status] = (byStatus[row.commercial_status] ?? 0) + 1
  byTechnology[row.technology] = (byTechnology[row.technology] ?? 0) + 1
  if (!ABNET_RESIDENTIAL_CATALOG[row.catalog_code]) outsideCatalog += 1
  if (Number(row.monthly_fee) !== PRICES[row.catalog_code] || Number(row.list_price) !== PRICES[row.catalog_code]) {
    wrongPrice += 1
  }
  perCustomer.set(row.customer_id, (perCustomer.get(row.customer_id) ?? 0) + 1)
}
const byType = {}
let missingNode = 0
let withIp = 0
const connectionServiceIds = new Set()
for (const row of liveConnections) {
  byType[row.connection_type] = (byType[row.connection_type] ?? 0) + 1
  if (!String(row.notes ?? "").startsWith("Nodo: ") || String(row.notes).length <= "Nodo: ".length) missingNode += 1
  if (row.ip_address) withIp += 1
  connectionServiceIds.add(row.service_id)
}
const serviceIds = new Set(liveServices.map((row) => row.id))
const servicesWithoutConnection = liveServices.filter((row) => !connectionServiceIds.has(row.id)).length
const connectionsWithoutService = liveConnections.filter((row) => !serviceIds.has(row.service_id)).length
const duplicateServiceCodes = liveServices.length - new Set(liveServices.map((row) => row.external_code)).size
const caseCIds = new Set()
for (const row of customers) {
  if (row.deleted_at) continue
  const number = abnetNumberFromExternalCode(row.external_customer_code)
  if (number && CASE_C.includes(number)) caseCIds.add(row.id)
}
const caseCServices = liveServices.filter((row) => caseCIds.has(row.customer_id)).length
const numbers = new Map()
for (const row of customers) {
  if (row.deleted_at) continue
  const number = abnetNumberFromExternalCode(row.external_customer_code)
  if (!number) continue
  numbers.set(number, (numbers.get(number) ?? 0) + 1)
}

const report = {
  services: liveServices.length,
  connections: liveConnections.length,
  byCode,
  byStatus,
  byTechnology,
  byType,
  withIp,
  missingNode,
  wrongPrice,
  outsideCatalog,
  servicesWithoutConnection,
  connectionsWithoutService,
  duplicateServiceCodes,
  customersWithService: perCustomer.size,
  customersWithMultipleServices: [...perCustomer.values()].filter((count) => count > 1).length,
  caseCStillWithoutService: caseCServices === 0,
  billingNumbersStillUnlinked: BILLING_NEW.every((number) => !numbers.has(number)),
  ambiguousNumbersStillDuplicated: [...numbers.values()].filter((count) => count > 1).length,
}
const ok =
  report.services === 3998 &&
  report.connections === 3998 &&
  report.missingNode === 0 &&
  report.wrongPrice === 0 &&
  report.outsideCatalog === 0 &&
  report.servicesWithoutConnection === 0 &&
  report.connectionsWithoutService === 0 &&
  report.duplicateServiceCodes === 0 &&
  report.byStatus.active === 3900 &&
  report.byStatus.pending_activation === 98 &&
  report.caseCStillWithoutService &&
  report.billingNumbersStillUnlinked &&
  report.ambiguousNumbersStillDuplicated === 7 &&
  !report.byStatus.cancelled &&
  !report.byStatus.suspended

console.log(JSON.stringify({ ok, ...report }, null, 2))
if (!ok) process.exit(1)
