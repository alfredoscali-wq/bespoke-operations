/**
 * Auditoría de solo lectura de las filas visibles del padrón TV.
 *
 * Lee abnet_tv_padron_rows y aplica las exclusiones activas, igual que la
 * tabla “TV del padrón”. No consulta customers, Clientes 360 ni LATAM.
 *
 * Uso: npx tsx scripts/abnet-tv-padron-duplicates-audit.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"
import {
  ABNET_TV_PADRON_SOURCE,
  abnetPadronCustomerNumber,
  abnetPadronMoney,
  abnetPadronTvRowLabel,
  classifyAbnetPadronTv,
  isAbnetJubiladoPlan,
} from "../lib/subscriptions/abnet-tv-padron.ts"
import { excludeAbnetPadronRows } from "../lib/subscriptions/abnet-tv-padron-exclusions.ts"
import { readAbnetTvPadronStatic } from "../lib/subscriptions/abnet-tv-padron-static.ts"
import { loadEnv } from "./abnet-residential-sources.mjs"

const PAGE = 1000
const COMPANY_ID = BESPOKE_PRODUCTION_COMPANY_ID
const CSV_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "output",
  "abnet-tv-padron-duplicados.csv"
)

export function assertReadOnlyInvocation(argv = process.argv) {
  if (argv.some((arg) => ["--apply", "--write", "--execute"].includes(arg))) {
    throw new Error("Esta auditoría no acepta escritura.")
  }
}

export function readOnlyFrom(client) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(`Auditoría de solo lectura: ${String(prop)} bloqueado en ${table}.`)
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
}

function clean(value) {
  if (value == null) return ""
  return String(value).trim()
}

function text(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

export function mapStoredPadronRow(row) {
  return {
    source: text(row.source) || ABNET_TV_PADRON_SOURCE,
    sourceRow: Number(row.source_row),
    abnetCustomerNumber: text(row.abnet_customer_number),
    customerName: text(row.customer_name),
    serviceType: text(row.service_type),
    node: text(row.node),
    planName: text(row.plan_name),
    status: text(row.status),
    tvAmount: abnetPadronMoney(row.tv_amount),
    tvTaxAmount: abnetPadronMoney(row.tv_tax_amount),
    finalAmount: abnetPadronMoney(row.final_amount),
  }
}

export function tvLabelForPadronRow(row) {
  const tv = classifyAbnetPadronTv(row.tvAmount)
  return abnetPadronTvRowLabel({
    tvKind: tv.kind,
    tvAmount: row.tvAmount,
    jubilado: isAbnetJubiladoPlan(row.planName),
  })
}

export function auditTvPadronDuplicates(rows, exclusions, companyId = COMPANY_ID) {
  const visible = excludeAbnetPadronRows(rows, exclusions, companyId)
  const groups = new Map()
  let withoutNumber = 0
  for (const row of visible) {
    const number = abnetPadronCustomerNumber(row.abnetCustomerNumber)
    if (!number) {
      withoutNumber += 1
      continue
    }
    const current = groups.get(number) ?? []
    current.push(row)
    groups.set(number, current)
  }
  const duplicates = [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort(([left], [right]) => Number(left) - Number(right) || left.localeCompare(right))
    .map(([number, list]) => ({
      number,
      count: list.length,
      rows: [...list].sort(
        (left, right) =>
          clean(left.source).localeCompare(clean(right.source)) || left.sourceRow - right.sourceRow
      ),
    }))
  const involved = duplicates.reduce((total, group) => total + group.count, 0)
  return {
    visible,
    withoutNumber,
    distinctNumbers: groups.size,
    duplicates,
    summary: {
      analyzed: visible.length,
      withoutNumber,
      distinctNumbers: groups.size,
      repeatedNumbers: duplicates.length,
      involvedRows: involved,
      extraRows: involved - duplicates.length,
    },
  }
}

function csvCell(value) {
  const current = value == null ? "" : String(value)
  if (/[",\n\r]/.test(current)) return `"${current.replaceAll('"', '""')}"`
  return current
}

export function duplicatesToCsv(duplicates) {
  const header = [
    "N° Cliente",
    "Filas",
    "source",
    "source_row",
    "Cliente",
    "Tipo",
    "Nodo",
    "Plan",
    "Estado",
    "TV",
  ]
  const lines = [header.join(",")]
  for (const group of duplicates) {
    for (const row of group.rows) {
      lines.push(
        [
          group.number,
          group.count,
          row.source,
          row.sourceRow,
          row.customerName,
          row.serviceType,
          row.node,
          row.planName,
          row.status,
          tvLabelForPadronRow(row),
        ]
          .map(csvCell)
          .join(",")
      )
    }
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`
}

export function assertDuplicateReport(duplicates, summary) {
  const numbers = duplicates.map((group) => group.number)
  if (new Set(numbers).size !== numbers.length) {
    throw new Error("Hay un N° Cliente repetido en el detalle.")
  }
  if (numbers.length !== summary.repeatedNumbers) {
    throw new Error("El resumen de N° repetidos no coincide con el detalle.")
  }
  const rows = duplicates.reduce((total, group) => total + group.rows.length, 0)
  if (rows !== summary.involvedRows) {
    throw new Error("El resumen de filas involucradas no coincide con el detalle.")
  }
  if (summary.extraRows !== summary.involvedRows - summary.repeatedNumbers) {
    throw new Error("Las filas adicionales no coinciden con el detalle.")
  }
  for (const group of duplicates) {
    if (group.count < 2 || group.rows.length !== group.count) {
      throw new Error(`El N° ${group.number} no tiene dos o más filas.`)
    }
  }
}

async function readPages(from, table, columns, filters) {
  const rows = []
  for (let start = 0; ; start += PAGE) {
    let query = from(table).select(columns)
    for (const filter of filters) query = filter(query)
    const { data, error } = await query.range(start, start + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

async function readVisiblePadron(from) {
  const stored = await readPages(
    from,
    "abnet_tv_padron_rows",
    "abnet_customer_number, customer_name, service_type, node, plan_name, status, tv_amount, tv_tax_amount, final_amount, source, source_row",
    [
      (query) => query.eq("company_id", COMPANY_ID),
      (query) => query.eq("source", ABNET_TV_PADRON_SOURCE),
      (query) => query.order("source_row", { ascending: true }),
    ]
  )
  let origin = "table"
  let rows = stored.map(mapStoredPadronRow)
  if (rows.length === 0) {
    rows = readAbnetTvPadronStatic()
    origin = "static"
  }
  const exclusionRows = await readPages(
    from,
    "abnet_tv_padron_exclusions",
    "company_id, source, source_row, abnet_customer_number, deleted_at",
    [
      (query) => query.eq("company_id", COMPANY_ID),
      (query) => query.is("deleted_at", null),
      (query) => query.order("source_row", { ascending: true }),
    ]
  )
  const exclusions = exclusionRows.flatMap((row) => {
    const number = abnetPadronCustomerNumber(row.abnet_customer_number)
    const sourceRow = Number(row.source_row)
    if (!number || !Number.isInteger(sourceRow) || sourceRow <= 0) return []
    return [
      {
        companyId: text(row.company_id) || COMPANY_ID,
        source: text(row.source) || ABNET_TV_PADRON_SOURCE,
        sourceRow,
        abnetCustomerNumber: number,
        deletedAt: null,
      },
    ]
  })
  return { origin, stored: rows.length, exclusions: exclusions.length, rows, exclusions }
}

function printReport(result, origin, stored, exclusions, csvPath) {
  const { summary, duplicates } = result
  console.log("Auditoría de solo lectura del padrón TV. No se modificó ninguna fila.")
  console.log(`Empresa: ${COMPANY_ID}`)
  console.log(`Origen: ${origin}`)
  console.log(`Filas cargadas: ${stored}`)
  console.log(`Exclusiones activas: ${exclusions.length}`)
  console.log("")
  for (const group of duplicates) {
    console.log(`${group.number} · ${group.count} filas`)
    for (const row of group.rows) {
      console.log(
        `  ${row.source}  ${row.sourceRow}  ${row.customerName}  ${row.serviceType}  ${row.node}  ${row.planName}  ${row.status}  ${tvLabelForPadronRow(row)}`
      )
    }
  }
  console.log("")
  console.log(`Filas del padrón TV analizadas: ${summary.analyzed}`)
  console.log(`Filas sin N° Cliente utilizable: ${summary.withoutNumber}`)
  console.log(`N° Cliente distintos: ${summary.distinctNumbers}`)
  console.log(`N° Cliente repetidos: ${summary.repeatedNumbers}`)
  console.log(`Filas involucradas en duplicados: ${summary.involvedRows}`)
  console.log(`Filas adicionales: ${summary.extraRows}`)
  console.log(`CSV: ${csvPath}`)
}

async function main() {
  assertReadOnlyInvocation()
  const env = loadEnv()
  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const loaded = await readVisiblePadron(readOnlyFrom(client))
  const result = auditTvPadronDuplicates(loaded.rows, loaded.exclusions, COMPANY_ID)
  assertDuplicateReport(result.duplicates, result.summary)
  mkdirSync(path.dirname(CSV_PATH), { recursive: true })
  writeFileSync(CSV_PATH, duplicatesToCsv(result.duplicates), "utf8")
  printReport(result, loaded.origin, loaded.stored, loaded.exclusions, CSV_PATH)
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
