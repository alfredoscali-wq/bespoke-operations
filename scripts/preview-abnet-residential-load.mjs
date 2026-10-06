/**
 * Preview de solo lectura de la carga residencial ABNet.
 * No inserta servicios ni conexiones.
 *
 * Uso: npx tsx scripts/preview-abnet-residential-load.mjs
 */
import { createClient } from "@supabase/supabase-js"

import {
  planAbnetResidentialLoad,
  residentialAuditMatches,
} from "../lib/isp/abnet-residential-load.ts"
import { abnetNumberFromExternalCode } from "../lib/isp/abnet-master-universe.ts"
import {
  ABNET_COMPANY_ID,
  DEFAULT_BILLING,
  DEFAULT_CONEX,
  fetchAll,
  loadEnv,
  readBillingRows,
  readInternetRows,
} from "./abnet-residential-sources.mjs"

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const conexPath = argValue("--conex") ?? DEFAULT_CONEX
const billingPath = argValue("--billing") ?? DEFAULT_BILLING
const internetRows = readInternetRows(conexPath)
const billingRows = readBillingRows(billingPath)
const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const customers = await fetchAll(
  client,
  "customers",
  "id, external_customer_code, deleted_at"
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
const loadByCatalog = {}
const loadByStatus = {}
for (const row of plan.loadRows) {
  loadByCatalog[row.catalogCode] = (loadByCatalog[row.catalogCode] ?? 0) + 1
  loadByStatus[row.sourceStatus] = (loadByStatus[row.sourceStatus] ?? 0) + 1
}

const samples = {}
for (const code of Object.keys(plan.byCatalog)) {
  samples[code] = plan.loadRows
    .filter((row) => row.catalogCode === code)
    .slice(0, 2)
    .map((row) => ({
      number: row.row.number,
      name: row.row.name,
      nodo: row.row.nodo,
      estado: row.sourceStatus,
      ip: row.ip,
    }))
}

const multi = []
const counts = new Map()
for (const row of plan.loadRows) {
  const current = counts.get(row.customerId) ?? []
  current.push(row)
  counts.set(row.customerId, current)
}
for (const rows of counts.values()) {
  if (rows.length < 2 || multi.length >= 6) continue
  multi.push(rows.map((row) => ({
    number: row.row.number,
    name: row.row.name,
    code: row.catalogCode,
    estado: row.sourceStatus,
    nodo: row.row.nodo,
  })))
}

const report = {
  readOnly: true,
  auditMatches: residentialAuditMatches(plan),
  candidateRows: plan.candidateRows,
  exactExtraRows: plan.exactExtraRows,
  servicesAfterCollapse: plan.servicesAfterCollapse,
  customersWithService: plan.customersWithService,
  connectionCandidates: plan.connectionCandidates,
  collapsedByCatalog: plan.byCatalog,
  sourceStatus: plan.sourceStatus,
  servicesToCreate: plan.loadRows.length,
  connectionsToCreate: plan.loadRows.length,
  loadByCatalog,
  loadByStatus,
  withIp: plan.withIp,
  withoutIp: plan.withoutIp,
  ambiguousIp: plan.ambiguousIp,
  residentialMultipleServiceCustomers: plan.residentialMultipleServiceCustomers,
  multipleServiceCustomersToCreate: plan.multipleServiceCustomers,
  excludedNoCustomer: plan.excludedNoCustomer,
  excludedAmbiguousCustomer: plan.excludedAmbiguousCustomer,
  excludedStatus: plan.excludedStatus,
  excludedSpecialInternetRows: plan.excludedSpecialInternetRows,
  samples,
  multipleSamples: multi,
}

console.log(JSON.stringify(report, null, 2))
if (!report.auditMatches) process.exit(1)
