/**
 * Materializa el padrón estático en abnet_tv_padron_rows y corrige
 * solo las filas Pendiente con un único servicio de Internet con TV Básica.
 * No modifica el JSON histórico, clientes, servicios ni conexiones.
 * No llama a LATAM.
 *
 * Uso: npx tsx scripts/apply-abnet-tv-padron-commercial.mjs --write
 */
import { readFileSync } from "node:fs"

import { createClient } from "@supabase/supabase-js"

import { abnetNumberFromExternalCode } from "../lib/isp/abnet-master-universe.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"
import {
  classifyAbnetPadronTv,
  presentAbnetPadronRow,
  summarizeAbnetTvPadron,
  withAbnetPadronDuplicates,
} from "../lib/subscriptions/abnet-tv-padron.ts"
import { planAbnetTvPadronCommercialCorrections } from "../lib/subscriptions/abnet-tv-padron-commercial.ts"

function envValue(name) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  const line = env.split(/\r?\n/).find((item) => item.startsWith(`${name}=`))
  if (!line) return ""
  return line.slice(name.length + 1).trim().replace(/^"|"$/g, "")
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const companyId = BESPOKE_PRODUCTION_COMPANY_ID
const source = "conex-internet-tv.xlsx"
const staticRows = JSON.parse(
  readFileSync(new URL("../lib/subscriptions/abnet-tv-padron.static.json", import.meta.url), "utf8")
)
const supabase = createClient(
  envValue("NEXT_PUBLIC_SUPABASE_URL"),
  envValue("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

async function all(table, columns) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("company_id", companyId)
      .range(from, from + 999)
    if (error) fail(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

async function count(table) {
  const { count: value, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("deleted_at", null)
  if (error) fail(`${table}: ${error.message}`)
  return value ?? 0
}

const [customers, services, catalogs, components, assignments] = await Promise.all([
  all("customers", "id, external_customer_code, deleted_at"),
  all("isp_services", "id, customer_id, catalog_id, catalog_code, technology, commercial_status, deleted_at"),
  all("isp_service_catalog", "id, code, technology, tv_plan_catalog_id, deleted_at"),
  all("isp_commercial_components", "id, code, deleted_at"),
  all("isp_service_components", "service_id, component_id, status, deleted_at"),
])
const catalogById = new Map(catalogs.filter((row) => !row.deleted_at).map((row) => [row.id, row]))
const fullIds = new Set(
  components
    .filter((row) => !row.deleted_at && String(row.code).toUpperCase() === "TV-FULL-UPGRADE")
    .map((row) => row.id)
)
const fullServices = new Set(
  assignments
    .filter((row) => !row.deleted_at && row.status === "active" && fullIds.has(row.component_id))
    .map((row) => row.service_id)
)
const customerIdsByNumber = new Map()
for (const customer of customers) {
  if (customer.deleted_at) continue
  const number = abnetNumberFromExternalCode(customer.external_customer_code)
  if (!number) continue
  const list = customerIdsByNumber.get(number) ?? []
  list.push(customer.id)
  customerIdsByNumber.set(number, list)
}
const basicaServicesByCustomer = new Map()
for (const service of services) {
  if (service.deleted_at || fullServices.has(service.id)) continue
  if (service.commercial_status !== "active" && service.commercial_status !== "pending_activation") {
    continue
  }
  const catalog = catalogById.get(service.catalog_id)
  const included = catalogById.get(catalog?.tv_plan_catalog_id)?.code ?? ""
  const code = String(service.catalog_code || catalog?.code || "").toUpperCase()
  if (code.includes("FULL") || code.includes("FUTBOL")) continue
  if (String(included).toUpperCase() !== "TV-BASICO" && !code.endsWith("TV-BASICO")) continue
  const technology = service.technology || catalog?.technology
  if (technology !== "ftth" && technology !== "wireless") continue
  const list = basicaServicesByCustomer.get(service.customer_id) ?? []
  list.push({ technology })
  basicaServicesByCustomer.set(service.customer_id, list)
}

const plan = planAbnetTvPadronCommercialCorrections({
  rows: staticRows,
  customerIdsByNumber,
  basicaServicesByCustomer,
})
const corrections = new Set(plan.sourceRows)
const before = summarizeAbnetTvPadron(
  withAbnetPadronDuplicates(staticRows).map(presentAbnetPadronRow)
)
const names = new Map(staticRows.map((row) => [row.sourceRow, row.customerName]))
console.log(
  JSON.stringify(
    {
      pending: staticRows.filter((row) => row.status === "Pendiente").length,
      ready: corrections.size,
      omitted: plan.omitted.length,
      basicaRowsBefore: before.basicaRows,
      omittedRows: plan.omitted.map((item) => ({
        sourceRow: item.sourceRow,
        number: item.abnetCustomerNumber,
        name: names.get(item.sourceRow) ?? "",
        reason: item.reason,
      })),
    },
    null,
    2
  )
)

if (!process.argv.includes("--write")) {
  console.log("Sin --write no se escribe.")
  process.exit(0)
}

function sameMoney(left, right) {
  if (left == null && right == null) return true
  return Number(left) === Number(right)
}

const existing = await supabase
  .from("abnet_tv_padron_rows")
  .select("id", { count: "exact", head: true })
  .eq("company_id", companyId)
  .eq("source", source)
if (existing.error) fail(existing.error.message)
if ((existing.count ?? 0) !== 0 && existing.count !== staticRows.length) {
  fail(`El padrón de Bespoke tiene ${existing.count} filas. No se reescribe un conjunto parcial.`)
}

const beforeCounts = {
  customers: await count("customers"),
  services: await count("isp_services"),
  connections: await count("isp_connections"),
}

const payload = staticRows.map((row) => ({
  company_id: companyId,
  abnet_customer_number: row.abnetCustomerNumber,
  customer_name: row.customerName,
  service_type: row.serviceType,
  node: row.node,
  plan_name: row.planName,
  status: corrections.has(row.sourceRow) ? "Activa" : row.status,
  tv_amount: corrections.has(row.sourceRow) ? 4500 : row.tvAmount,
  tv_tax_amount: row.tvTaxAmount,
  final_amount: row.finalAmount,
  source: row.source,
  source_row: row.sourceRow,
}))

if ((existing.count ?? 0) === 0) {
  for (let index = 0; index < payload.length; index += 400) {
    const inserted = await supabase.from("abnet_tv_padron_rows").insert(payload.slice(index, index + 400))
    if (inserted.error) {
      await supabase.from("abnet_tv_padron_rows").delete().eq("company_id", companyId).eq("source", source)
      fail(inserted.error.message)
    }
  }
}

const stored = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("abnet_tv_padron_rows")
    .select("source_row, abnet_customer_number, service_type, status, tv_amount, source")
    .eq("company_id", companyId)
    .eq("source", source)
    .range(from, from + 999)
  if (error) fail(error.message)
  stored.push(...(data ?? []))
  if ((data ?? []).length < 1000) break
}
if (stored.length !== staticRows.length) {
  await supabase.from("abnet_tv_padron_rows").delete().eq("company_id", companyId).eq("source", source)
  fail(`Quedaron ${stored.length} filas en vez de ${staticRows.length}. Se revirtió.`)
}
const storedByRow = new Map(stored.map((row) => [row.source_row, row]))
for (const row of staticRows) {
  const saved = storedByRow.get(row.sourceRow)
  if (!saved) fail(`Falta la fila ${row.sourceRow}.`)
  if (corrections.has(row.sourceRow)) {
    if (saved.status !== "Activa" || Number(saved.tv_amount) !== 4500) {
      fail(`La fila ${row.sourceRow} no quedó Activa con TV Básica.`)
    }
  } else if (saved.status !== row.status || !sameMoney(saved.tv_amount, row.tvAmount)) {
    fail(`La fila ${row.sourceRow} cambió sin estar en la corrección.`)
  }
}
const after = summarizeAbnetTvPadron(
  stored.map((row) => ({
    abnetCustomerNumber: abnetNumberFromExternalCode(row.abnet_customer_number) ?? "",
    tvKind: classifyAbnetPadronTv(row.tv_amount == null ? null : Number(row.tv_amount)).kind,
    jubilado: false,
    status: row.status,
    tvAmount: row.tv_amount == null ? null : Number(row.tv_amount),
  }))
)
const fiber = storedByRow.get(10)
const wireless = storedByRow.get(1345)
const afterCounts = {
  customers: await count("customers"),
  services: await count("isp_services"),
  connections: await count("isp_connections"),
}
const newest = {}
for (const table of ["customers", "isp_services", "isp_connections"]) {
  const { data, error } = await supabase
    .from(table)
    .select("created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
  if (error) fail(`${table}: ${error.message}`)
  newest[table] = data?.[0]?.created_at ?? null
}
console.log(
  JSON.stringify(
    {
      stored: stored.length,
      corrected: corrections.size,
      pendingLeft: stored.filter((row) => row.status === "Pendiente").length,
      basicaRowsBefore: before.basicaRows,
      basicaRowsAfter: after.basicaRows,
      fiber5814: fiber ? { status: fiber.status, tv: Number(fiber.tv_amount), type: fiber.service_type } : null,
      wireless5814: wireless
        ? { status: wireless.status, tv: Number(wireless.tv_amount), type: wireless.service_type }
        : null,
      counts: { before: beforeCounts, after: afterCounts },
      newestRecord: newest,
      label: classifyAbnetPadronTv(4500).label,
    },
    null,
    2
  )
)
