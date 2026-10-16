/**
 * Representación provisoria de las 42 filas Pendiente omitidas.
 * Solo actualiza status y tv_amount en abnet_tv_padron_rows.
 * No toca clientes, servicios, conexiones, Clientes 360, el JSON ni LATAM.
 *
 * Uso: npx tsx scripts/apply-abnet-tv-padron-pending-provisional.mjs --write
 */
import { readFileSync } from "node:fs"

import { createClient } from "@supabase/supabase-js"

import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"
import {
  classifyAbnetPadronTv,
  summarizeAbnetTvPadron,
} from "../lib/subscriptions/abnet-tv-padron.ts"

const OMITTED_SOURCE_ROWS = [
  11, 63, 82, 86, 102, 120, 132, 135, 141, 156, 262, 263, 268, 269, 297, 315, 400,
  408, 425, 623, 704, 855, 1014, 1058, 1106, 1233, 1313, 1515, 1525, 1530, 1637,
  1787, 1881, 1948, 2068, 2162, 2331, 2401, 2549, 2670, 2728, 2826,
]

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

function sameSet(left, right) {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

const companyId = BESPOKE_PRODUCTION_COMPANY_ID
const source = "conex-internet-tv.xlsx"
const expected = new Set(OMITTED_SOURCE_ROWS)
if (expected.size !== 42) fail(`La lista omitida tiene ${expected.size} filas, no 42.`)

const staticRows = JSON.parse(
  readFileSync(new URL("../lib/subscriptions/abnet-tv-padron.static.json", import.meta.url), "utf8")
)
const previousCorrections = new Set(
  staticRows
    .filter((row) => row.status === "Pendiente" && !expected.has(row.sourceRow))
    .map((row) => row.sourceRow)
)

const supabase = createClient(
  envValue("NEXT_PUBLIC_SUPABASE_URL"),
  envValue("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

async function padronRows() {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("abnet_tv_padron_rows")
      .select("source_row, abnet_customer_number, customer_name, service_type, status, tv_amount")
      .eq("company_id", companyId)
      .eq("source", source)
      .range(from, from + 999)
    if (error) fail(error.message)
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

function summary(rows) {
  return summarizeAbnetTvPadron(
    rows.map((row) => ({
      abnetCustomerNumber: String(row.abnet_customer_number ?? ""),
      tvKind: classifyAbnetPadronTv(row.tv_amount == null ? null : Number(row.tv_amount)).kind,
      jubilado: false,
      status: row.status,
      tvAmount: row.tv_amount == null ? null : Number(row.tv_amount),
    }))
  )
}

const beforeRows = await padronRows()
const pending = beforeRows.filter((row) => row.status === "Pendiente")
const pendingIds = new Set(pending.map((row) => row.source_row))
const missing = [...expected].filter((id) => !pendingIds.has(id))
const extra = [...pendingIds].filter((id) => !expected.has(id))

if (beforeRows.length !== 4764 || pending.length !== 42 || !sameSet(pendingIds, expected)) {
  console.log(
    JSON.stringify(
      {
        stopped: true,
        stored: beforeRows.length,
        pending: pending.length,
        expected: expected.size,
        missingFromPending: missing,
        unexpectedPending: extra,
      },
      null,
      2
    )
  )
  fail("El universo pendiente no es exactamente las 42 filas omitidas. No se escribe.")
}

const withAmount = pending.filter((row) => row.tv_amount != null)
const beforeSummary = summary(beforeRows)
const outside = beforeRows.filter((row) => !expected.has(row.source_row))
const changedOutside = outside.filter((row) => {
  const original = staticRows.find((item) => item.sourceRow === row.source_row)
  if (!original) return true
  if (previousCorrections.has(row.source_row)) {
    return row.status !== "Activa" || Number(row.tv_amount) !== 4500
  }
  const sameAmount =
    (row.tv_amount == null && original.tvAmount == null) ||
    Number(row.tv_amount) === Number(original.tvAmount)
  return row.status !== original.status || !sameAmount
})

console.log(
  JSON.stringify(
    {
      pending: pending.length,
      sourceRows: [...pendingIds].sort((a, b) => a - b),
      alreadyWithTvAmount: withAmount.map((row) => ({
        sourceRow: row.source_row,
        tvAmount: row.tv_amount == null ? null : Number(row.tv_amount),
      })),
      basicaRowsBefore: beforeSummary.basicaRows,
      previousCorrections: previousCorrections.size,
      rowsOutsideAlreadyChanged: changedOutside.map((row) => row.source_row),
    },
    null,
    2
  )
)

if (beforeSummary.basicaRows !== 4343 || changedOutside.length > 0) {
  fail("El padrón no está en el estado esperado de la corrección anterior. No se escribe.")
}
if (previousCorrections.size !== 94) {
  fail(`Las correcciones anteriores son ${previousCorrections.size}, no 94. No se escribe.`)
}
if (!process.argv.includes("--write")) {
  console.log("Sin --write no se escribe.")
  process.exit(0)
}

const beforeCounts = {
  customers: await count("customers"),
  services: await count("isp_services"),
  connections: await count("isp_connections"),
  subscribers: await count("isp_subscribers"),
}

const updated = await supabase
  .from("abnet_tv_padron_rows")
  .update({ status: "Activa", tv_amount: 4500 })
  .eq("company_id", companyId)
  .eq("source", source)
  .eq("status", "Pendiente")
  .in("source_row", [...expected])
  .select("source_row")
if (updated.error) fail(updated.error.message)
if ((updated.data ?? []).length !== 42) {
  fail(`La actualización devolvió ${(updated.data ?? []).length} filas, no 42.`)
}

const afterRows = await padronRows()
const afterPending = afterRows.filter((row) => row.status === "Pendiente")
const afterByRow = new Map(afterRows.map((row) => [row.source_row, row]))
const beforeByRow = new Map(beforeRows.map((row) => [row.source_row, row]))
for (const row of beforeRows) {
  const saved = afterByRow.get(row.source_row)
  if (!saved) fail(`Falta la fila ${row.source_row}.`)
  if (expected.has(row.source_row)) {
    if (saved.status !== "Activa" || Number(saved.tv_amount) !== 4500) {
      fail(`La fila ${row.source_row} no quedó Activa con TV Básica.`)
    }
    continue
  }
  const sameAmount =
    (saved.tv_amount == null && row.tv_amount == null) ||
    Number(saved.tv_amount) === Number(row.tv_amount)
  if (saved.status !== row.status || !sameAmount) {
    fail(`La fila ${row.source_row} cambió fuera de las 42.`)
  }
}
for (const sourceRow of previousCorrections) {
  const saved = afterByRow.get(sourceRow)
  const prior = beforeByRow.get(sourceRow)
  if (!saved || !prior || saved.status !== prior.status || Number(saved.tv_amount) !== Number(prior.tv_amount)) {
    fail(`La corrección anterior ${sourceRow} cambió.`)
  }
}

const afterCounts = {
  customers: await count("customers"),
  services: await count("isp_services"),
  connections: await count("isp_connections"),
  subscribers: await count("isp_subscribers"),
}
const afterSummary = summary(afterRows)
console.log(
  JSON.stringify(
    {
      stored: afterRows.length,
      updated: (updated.data ?? []).length,
      pendingAfter: afterPending.length,
      basicaRowsBefore: beforeSummary.basicaRows,
      basicaRowsAfter: afterSummary.basicaRows,
      label: classifyAbnetPadronTv(4500).label,
      counts: { before: beforeCounts, after: afterCounts },
    },
    null,
    2
  )
)
